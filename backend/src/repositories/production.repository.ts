import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import {
  AdvanceProductionStatusInput,
  CreateProductionInput,
  Production,
  ProductionMaterial,
  ProductionStatusAssignment,
  ProductionStageOption,
  ProductionStatus,
  SetProductionStatusesInput,
} from "../models/production.model";
import { AppError } from "../utils/app-error";

type CreateProductionRepositoryInput = CreateProductionInput & {
  installationTeam: string | null;
};

interface ProductionOrderRow {
  id: string;
  client_name: string;
  description: string;
  production_status: string;
  completed_at?: string | Date | null;
  delivery_date: string | Date | null;
  installation_team_id: string | null;
  installation_team: string | null;
  initial_cost: string | number;
}

interface ProductionStatusStageRow {
  id: string;
  name: string;
  normalized_name: string;
  usage_count?: string | number;
}

interface ProductionStatusAssignmentRow {
  id: string;
  production_id: string;
  stage_id: string;
  stage_name: string;
  team_id: string | null;
  team_name: string | null;
  created_at: string | Date;
}

interface ProductionWithMaterialRow extends ProductionOrderRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number | null;
}

interface ProductionMaterialUsageRow {
  product_id: string;
  product_name: string | null;
  quantity: string | number;
  unit: string | null;
}

interface ProductStockRow {
  id: string;
  stock_quantity: string | number;
}

let productIdColumnExists: boolean | null = null;
let unitPriceColumnExists: boolean | null = null;
let installationTeamIdColumnExists: boolean | null = null;
let teamMembersTableExists: boolean | null = null;
let productsTableExists: boolean | null = null;
let productStockQuantityColumnExists: boolean | null = null;
let productStockMovementsTableExists: boolean | null = null;
let productNameColumnExists: boolean | null = null;
let productionStatusStagesTableExists: boolean | null = null;
let productionOrderStatusesTableExists: boolean | null = null;

const STATUS_ALIASES: Record<string, string> = {
  pendente: "pending",
  corte: "cutting",
  montagem: "assembly",
  acabamento: "finishing",
  controle: "quality_check",
  aprovado: "approved",
  entregue: "delivered",
  concluido: "delivered",
  concluida: "delivered",
  completed: "delivered",
};

const DEFAULT_STAGE_NAMES = [
  "pending",
  "cutting",
  "assembly",
  "finishing",
  "quality_check",
  "approved",
  "delivered",
] as const;

function normalizeStageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function toNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeProductionStatus(status: string): ProductionStatus {
  const normalizedStatus = status.trim();

  if (normalizedStatus.length === 0) {
    return "pending";
  }

  return STATUS_ALIASES[normalizedStatus.toLowerCase()] ?? normalizedStatus;
}

function mapProductionRow(row: ProductionOrderRow): Production {
  return {
    id: row.id,
    clientName: row.client_name,
    description: row.description,
    productionStatus: normalizeProductionStatus(row.production_status),
    statuses: [],
    deliveryDate: toDateString(row.delivery_date),
    installationTeamId: row.installation_team_id,
    installationTeam: row.installation_team,
    initialCost: toNumber(row.initial_cost),
    materials: [],
  };
}

function mapMaterialRow(row: ProductionWithMaterialRow): ProductionMaterial | null {
  if (row.product_name === null || row.quantity === null || row.unit === null) {
    return null;
  }

  const material: ProductionMaterial = {
    productName: row.product_name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    unitPrice: toNumber(row.unit_price),
  };

  if (row.product_id) {
    material.productId = row.product_id;
  }

  return material;
}

function normalizeMaterial(input: CreateProductionInput["materials"][number]): ProductionMaterial {
  const material: ProductionMaterial = {
    productName: input.productName,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: toNumber(input.unitPrice ?? 0),
  };

  if (input.productId) {
    material.productId = input.productId;
  }

  return material;
}

function groupRows(rows: ProductionWithMaterialRow[]): Production[] {
  const productionsById = new Map<string, Production>();

  for (const row of rows) {
    const existing = productionsById.get(row.id);

    if (!existing) {
      productionsById.set(row.id, mapProductionRow(row));
    }

    const material = mapMaterialRow(row);

    if (material) {
      productionsById.get(row.id)?.materials.push(material);
    }
  }

  return [...productionsById.values()];
}

function mapStatusAssignmentRow(row: ProductionStatusAssignmentRow): ProductionStatusAssignment {
  return {
    id: row.id,
    stageId: row.stage_id,
    stageName: row.stage_name,
    teamId: row.team_id,
    teamName: row.team_name,
    createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
  };
}

function updateLegacyStatusFromAssignments(production: Production): void {
  if (production.statuses.length === 0) {
    return;
  }

  production.productionStatus = production.statuses.map((status) => status.stageName).join(", ");
}

async function hasProductionStatusStagesTable(client: PoolClient): Promise<boolean> {
  if (productionStatusStagesTableExists !== null) {
    return productionStatusStagesTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'production_status_stages'
      ) AS exists;
    `,
  );

  productionStatusStagesTableExists = Boolean(result.rows[0]?.exists);
  return productionStatusStagesTableExists;
}

async function hasProductionOrderStatusesTable(client: PoolClient): Promise<boolean> {
  if (productionOrderStatusesTableExists !== null) {
    return productionOrderStatusesTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'production_order_statuses'
      ) AS exists;
    `,
  );

  productionOrderStatusesTableExists = Boolean(result.rows[0]?.exists);
  return productionOrderStatusesTableExists;
}

async function hasProductionStatusesSchema(client: PoolClient): Promise<boolean> {
  const hasStages = await hasProductionStatusStagesTable(client);
  const hasAssignments = await hasProductionOrderStatusesTable(client);
  return hasStages && hasAssignments;
}

async function listStatusesByProductionIds(
  client: PoolClient,
  productionIds: string[],
): Promise<Map<string, ProductionStatusAssignment[]>> {
  const statusesByProduction = new Map<string, ProductionStatusAssignment[]>();

  if (productionIds.length === 0) {
    return statusesByProduction;
  }

  const hasSchema = await hasProductionStatusesSchema(client);

  if (!hasSchema) {
    return statusesByProduction;
  }

  const result = await client.query<ProductionStatusAssignmentRow>(
    `
      SELECT
        pos.id,
        pos.production_id,
        pos.stage_id,
        pss.name AS stage_name,
        pos.team_id,
        t.name AS team_name,
        pos.created_at
      FROM public.production_order_statuses pos
      INNER JOIN public.production_status_stages pss
        ON pss.id = pos.stage_id
      LEFT JOIN public.teams t
        ON t.id = pos.team_id
      WHERE pos.production_id = ANY($1::text[])
      ORDER BY pos.created_at ASC;
    `,
    [productionIds],
  );

  for (const row of result.rows) {
    const assignment = mapStatusAssignmentRow(row);
    const existing = statusesByProduction.get(row.production_id) ?? [];
    existing.push(assignment);
    statusesByProduction.set(row.production_id, existing);
  }

  return statusesByProduction;
}

async function enrichProductionsWithStatuses(client: PoolClient, productions: Production[]): Promise<void> {
  const productionIds = productions.map((production) => production.id);
  const statusesByProduction = await listStatusesByProductionIds(client, productionIds);

  for (const production of productions) {
    production.statuses = statusesByProduction.get(production.id) ?? [];
    updateLegacyStatusFromAssignments(production);
  }
}

async function hasProductIdColumn(client: PoolClient): Promise<boolean> {
  if (productIdColumnExists !== null) {
    return productIdColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'production_order_materials'
          AND column_name = 'product_id'
      ) AS exists;
    `,
  );

  productIdColumnExists = Boolean(result.rows[0]?.exists);
  return productIdColumnExists;
}

async function hasUnitPriceColumn(client: PoolClient): Promise<boolean> {
  if (unitPriceColumnExists !== null) {
    return unitPriceColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'production_order_materials'
          AND column_name = 'unit_price'
      ) AS exists;
    `,
  );

  unitPriceColumnExists = Boolean(result.rows[0]?.exists);
  return unitPriceColumnExists;
}

async function hasInstallationTeamIdColumn(client: PoolClient): Promise<boolean> {
  if (installationTeamIdColumnExists !== null) {
    return installationTeamIdColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'production_orders'
          AND column_name = 'installation_team_id'
      ) AS exists;
    `,
  );

  installationTeamIdColumnExists = Boolean(result.rows[0]?.exists);
  return installationTeamIdColumnExists;
}

async function hasTeamMembersTable(client: PoolClient): Promise<boolean> {
  if (teamMembersTableExists !== null) {
    return teamMembersTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'team_members'
      ) AS exists;
    `,
  );

  teamMembersTableExists = Boolean(result.rows[0]?.exists);
  return teamMembersTableExists;
}

async function hasProductsTable(client: PoolClient): Promise<boolean> {
  if (productsTableExists !== null) {
    return productsTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'products'
      ) AS exists;
    `,
  );

  productsTableExists = Boolean(result.rows[0]?.exists);
  return productsTableExists;
}

async function hasProductStockQuantityColumn(client: PoolClient): Promise<boolean> {
  if (productStockQuantityColumnExists !== null) {
    return productStockQuantityColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'stock_quantity'
      ) AS exists;
    `,
  );

  productStockQuantityColumnExists = Boolean(result.rows[0]?.exists);
  return productStockQuantityColumnExists;
}

async function hasProductStockMovementsTable(client: PoolClient): Promise<boolean> {
  if (productStockMovementsTableExists !== null) {
    return productStockMovementsTableExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'product_stock_movements'
      ) AS exists;
    `,
  );

  productStockMovementsTableExists = Boolean(result.rows[0]?.exists);
  return productStockMovementsTableExists;
}

async function hasProductNameColumn(client: PoolClient): Promise<boolean> {
  if (productNameColumnExists !== null) {
    return productNameColumnExists;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'name'
      ) AS exists;
    `,
  );

  productNameColumnExists = Boolean(result.rows[0]?.exists);
  return productNameColumnExists;
}

async function ensureStockControlSchema(client: PoolClient): Promise<void> {
  const hasProducts = await hasProductsTable(client);
  const hasStockColumn = await hasProductStockQuantityColumn(client);
  const hasMovements = await hasProductStockMovementsTable(client);

  if (!hasProducts || !hasStockColumn || !hasMovements) {
    throw new AppError(
      "Stock control schema is not configured. Run sql/20260317_add_product_stock_movements.sql",
      500,
    );
  }
}

async function resolveProductIdForMaterial(
  client: PoolClient,
  productionOrderId: string,
  material: ProductionMaterialUsageRow,
): Promise<string> {
  if (material.product_id && material.product_id.trim().length > 0) {
    return material.product_id.trim();
  }

  if (!material.product_name || material.product_name.trim().length === 0) {
    throw new AppError("Cannot resolve product for stock deduction", 400, {
      productionOrderId,
      productName: material.product_name,
    });
  }

  const canUseProductName = await hasProductNameColumn(client);

  if (!canUseProductName) {
    throw new AppError(
      "Products table does not have name column. Run sql/20260317_add_product_stock_movements.sql",
      500,
    );
  }

  const productByNameResult = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM public.products
      WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
      ORDER BY id::text
      LIMIT 2;
    `,
    [material.product_name],
  );

  if (productByNameResult.rows.length === 0) {
    throw new AppError("Material product was not found in products table", 400, {
      productionOrderId,
      productName: material.product_name,
    });
  }

  if (productByNameResult.rows.length > 1) {
    throw new AppError("Multiple products found for material name", 409, {
      productionOrderId,
      productName: material.product_name,
    });
  }

  return productByNameResult.rows[0].id;
}

async function updateProductionStatus(
  client: PoolClient,
  productionOrderId: string,
  nextStatus: ProductionStatus,
): Promise<ProductionStatus> {
  try {
    await client.query(
      `
        UPDATE public.production_orders
        SET
          production_status = $2,
          completed_at = CASE
            WHEN $2::text = ANY(ARRAY['approved', 'delivered'])
              THEN COALESCE(completed_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = $1;
      `,
      [productionOrderId, nextStatus],
    );

    return nextStatus;
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "23514" || code === "22P02") {
      throw new AppError(
        "Production status workflow schema is not configured. Run sql/20260318_expand_production_status_flow.sql",
        500,
      );
    }

    throw error;
  }
}

async function updateProductionAsApproved(client: PoolClient, productionOrderId: string): Promise<ProductionStatus> {
  return updateProductionStatus(client, productionOrderId, "approved");
}

async function deductMaterialsFromStock(client: PoolClient, productionOrderId: string): Promise<void> {
  const canUseProductId = await hasProductIdColumn(client);

  await ensureStockControlSchema(client);

  const materialsResult = canUseProductId
    ? await client.query<ProductionMaterialUsageRow>(
        `
          SELECT
            pom.product_id,
            pom.product_name,
            SUM(pom.quantity) AS quantity,
            MAX(pom.unit) AS unit
          FROM public.production_order_materials pom
          WHERE pom.production_order_id = $1
          GROUP BY pom.product_id, pom.product_name;
        `,
        [productionOrderId],
      )
    : await client.query<ProductionMaterialUsageRow>(
        `
          SELECT
            NULL::text AS product_id,
            pom.product_name,
            SUM(pom.quantity) AS quantity,
            MAX(pom.unit) AS unit
          FROM public.production_order_materials pom
          WHERE pom.production_order_id = $1
          GROUP BY pom.product_name;
        `,
        [productionOrderId],
      );

  for (const material of materialsResult.rows) {
    const quantityToDeduct = toNumber(material.quantity);
    const resolvedProductId = await resolveProductIdForMaterial(client, productionOrderId, material);

    if (quantityToDeduct <= 0) {
      continue;
    }

    const stockUpdateResult = await client.query<ProductStockRow>(
      `
        UPDATE public.products
        SET stock_quantity = stock_quantity - $1
        WHERE id::text = $2
          AND stock_quantity >= $1
        RETURNING
          id::text AS id,
          stock_quantity;
      `,
      [quantityToDeduct, resolvedProductId],
    );

    if (stockUpdateResult.rows.length === 0) {
      const productResult = await client.query<{ stock_quantity: string | number }>(
        `
          SELECT stock_quantity
          FROM public.products
          WHERE id::text = $1;
        `,
        [resolvedProductId],
      );

      if (productResult.rows.length === 0) {
        throw new AppError("Material product was not found in products table", 400, {
          productionOrderId,
          productId: resolvedProductId,
          productName: material.product_name,
        });
      }

      throw new AppError("Insufficient stock to complete production", 409, {
        productionOrderId,
        productId: resolvedProductId,
        productName: material.product_name,
        requestedQuantity: quantityToDeduct,
        availableStock: toNumber(productResult.rows[0]?.stock_quantity ?? 0),
      });
    }

    await client.query(
      `
        INSERT INTO public.product_stock_movements (
          product_id,
          movement_type,
          quantity,
          unit,
          reason,
          reference_type,
          reference_id
        )
        VALUES ($1, 'saida', $2, $3, $4, 'production_order', $5);
      `,
      [
        resolvedProductId,
        quantityToDeduct,
        material.unit,
        "Automatic outbound movement from production completion",
        productionOrderId,
      ],
    );
  }
}

async function ensureProductionExistsForUpdate(client: PoolClient, productionId: string): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM public.production_orders
      WHERE id::text = $1
      FOR UPDATE;
    `,
    [productionId],
  );

  return result.rows.length > 0;
}

async function ensureTeamExists(client: PoolClient, teamId: string): Promise<void> {
  const result = await client.query<{ id: string }>(
    `
      SELECT id
      FROM public.teams
      WHERE id = $1
      LIMIT 1;
    `,
    [teamId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Team not found", 400, { teamId });
  }
}

async function resolveStatusStage(
  client: PoolClient,
  input: AdvanceProductionStatusInput,
): Promise<ProductionStatusStageRow> {
  if (input.stageId) {
    const existing = await client.query<ProductionStatusStageRow>(
      `
        SELECT
          id,
          name,
          normalized_name
        FROM public.production_status_stages
        WHERE id = $1
        LIMIT 1;
      `,
      [input.stageId],
    );

    if (existing.rows.length === 0) {
      throw new AppError("Status stage not found", 400, { stageId: input.stageId });
    }

    return existing.rows[0];
  }

  const stageName = input.stageName?.trim() ?? "";
  const normalizedName = normalizeStageName(stageName);

  if (!stageName || !normalizedName) {
    throw new AppError("stageName is required", 400);
  }

  const inserted = await client.query<ProductionStatusStageRow>(
    `
      INSERT INTO public.production_status_stages (id, name, normalized_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (normalized_name)
      DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
      RETURNING
        id,
        name,
        normalized_name;
    `,
    [randomUUID(), stageName, normalizedName],
  );

  return inserted.rows[0];
}

async function syncLegacyProductionStatus(client: PoolClient, productionId: string): Promise<void> {
  const result = await client.query<{ joined_statuses: string | null }>(
    `
      SELECT
        NULLIF(STRING_AGG(pss.name, ', ' ORDER BY pos.created_at ASC), '') AS joined_statuses
      FROM public.production_order_statuses pos
      INNER JOIN public.production_status_stages pss
        ON pss.id = pos.stage_id
      WHERE pos.production_id = $1;
    `,
    [productionId],
  );

  const joinedStatuses = result.rows[0]?.joined_statuses?.trim() ?? "pending";

  await client.query(
    `
      UPDATE public.production_orders
      SET
        production_status = $2,
        updated_at = NOW()
      WHERE id::text = $1;
    `,
    [productionId, joinedStatuses],
  );
}

async function createStatusAssignment(
  client: PoolClient,
  productionId: string,
  input: AdvanceProductionStatusInput,
  resolvedStage?: ProductionStatusStageRow,
): Promise<void> {
  await ensureTeamExists(client, input.teamId);
  const stage = resolvedStage ?? (await resolveStatusStage(client, input));

  await client.query(
    `
      INSERT INTO public.production_order_statuses (
        id,
        production_id,
        stage_id,
        team_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (production_id, stage_id, team_id)
      DO NOTHING;
    `,
    [randomUUID(), productionId, stage.id, input.teamId],
  );

  await syncLegacyProductionStatus(client, productionId);
}

async function ensureDefaultStatusStages(client: PoolClient): Promise<void> {
  for (const stageName of DEFAULT_STAGE_NAMES) {
    const normalizedName = normalizeStageName(stageName);

    await client.query(
      `
        INSERT INTO public.production_status_stages (id, name, normalized_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (normalized_name)
        DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW();
      `,
      [randomUUID(), stageName, normalizedName],
    );
  }
}

async function listStatusOptions(): Promise<ProductionStageOption[]> {
  const client = await pool.connect();

  try {
    const hasSchema = await hasProductionStatusesSchema(client);

    if (!hasSchema) {
      return [];
    }

    await ensureDefaultStatusStages(client);

    const result = await client.query<ProductionStatusStageRow>(
      `
        SELECT
          pss.id,
          pss.name,
          pss.normalized_name,
          COUNT(pos.id)::int AS usage_count
        FROM public.production_status_stages pss
        LEFT JOIN public.production_order_statuses pos
          ON pos.stage_id = pss.id
        GROUP BY pss.id, pss.name, pss.normalized_name
        ORDER BY usage_count DESC, pss.name ASC;
      `,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      normalizedName: row.normalized_name,
      usageCount: toNumber(row.usage_count ?? 0),
    }));
  } finally {
    client.release();
  }
}

async function listById(id: string): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const canUseUnitPrice = await hasUnitPriceColumn(client);
    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";
    const unitPriceSelect = canUseUnitPrice ? "pom.unit_price" : "0::numeric AS unit_price";
    const installationTeamIdSelect = canUseInstallationTeamId
      ? "po.installation_team_id"
      : "NULL::text AS installation_team_id";

    const result = await client.query<ProductionWithMaterialRow>(
      `
        SELECT
          po.id::text AS id,
          po.client_name,
          po.description,
          po.production_status,
          po.delivery_date,
          ${installationTeamIdSelect},
          po.installation_team,
          po.initial_cost,
          ${productIdSelect},
          pom.product_name,
          pom.quantity,
          pom.unit,
          ${unitPriceSelect}
        FROM public.production_orders po
        LEFT JOIN public.production_order_materials pom
          ON pom.production_order_id = po.id
        WHERE po.id = $1
        ORDER BY po.created_at DESC, pom.id ASC;
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const productions = groupRows(result.rows);
    await enrichProductionsWithStatuses(client, productions);
    return productions[0];
  } finally {
    client.release();
  }
}

async function findAll(employeeId?: string): Promise<Production[]> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const canUseUnitPrice = await hasUnitPriceColumn(client);
    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const canUseTeamMembersTable = await hasTeamMembersTable(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";
    const unitPriceSelect = canUseUnitPrice ? "pom.unit_price" : "0::numeric AS unit_price";
    const installationTeamIdSelect = canUseInstallationTeamId
      ? "po.installation_team_id"
      : "NULL::text AS installation_team_id";

    if (employeeId && (!canUseInstallationTeamId || !canUseTeamMembersTable)) {
      return [];
    }

    const filterByEmployee = Boolean(employeeId);
    const employeeJoin = filterByEmployee
      ? "INNER JOIN public.team_members tm ON tm.team_id = po.installation_team_id"
      : "";
    const employeeWhere = filterByEmployee ? "WHERE tm.employee_id = $1" : "";

    const result = await client.query<ProductionWithMaterialRow>(
      `
        SELECT
          po.id::text AS id,
          po.client_name,
          po.description,
          po.production_status,
          po.delivery_date,
          ${installationTeamIdSelect},
          po.installation_team,
          po.initial_cost,
          ${productIdSelect},
          pom.product_name,
          pom.quantity,
          pom.unit,
          ${unitPriceSelect}
        FROM public.production_orders po
        ${employeeJoin}
        LEFT JOIN public.production_order_materials pom
          ON pom.production_order_id = po.id
        ${employeeWhere}
        ORDER BY po.created_at DESC, pom.id ASC;
      `,
      employeeId ? [employeeId] : undefined,
    );

    const productions = groupRows(result.rows);
    await enrichProductionsWithStatuses(client, productions);
    return productions;
  } finally {
    client.release();
  }
}

async function create(payload: CreateProductionRepositoryInput): Promise<Production> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const canUseProductId = await hasProductIdColumn(client);
    const canUseUnitPrice = await hasUnitPriceColumn(client);
    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);

    const productionInsert = canUseInstallationTeamId
      ? await client.query<ProductionOrderRow>(
          `
            INSERT INTO public.production_orders (
              client_name,
              description,
              production_status,
              delivery_date,
              installation_team,
              installation_team_id,
              initial_cost
            )
            VALUES ($1, $2, 'pending', $3, $4, $5, $6)
            RETURNING
              id::text AS id,
              client_name,
              description,
              production_status,
              delivery_date,
              installation_team_id,
              installation_team,
              initial_cost;
          `,
          [
            payload.clientName,
            payload.description,
            payload.deliveryDate ?? null,
            payload.installationTeam,
            payload.installationTeamId,
            payload.initialCost,
          ],
        )
      : await client.query<ProductionOrderRow>(
          `
            INSERT INTO public.production_orders (
              client_name,
              description,
              production_status,
              delivery_date,
              installation_team,
              initial_cost
            )
            VALUES ($1, $2, 'pending', $3, $4, $5)
            RETURNING
              id::text AS id,
              client_name,
              description,
              production_status,
              delivery_date,
              NULL::text AS installation_team_id,
              installation_team,
              initial_cost;
          `,
          [
            payload.clientName,
            payload.description,
            payload.deliveryDate ?? null,
            payload.installationTeam,
            payload.initialCost,
          ],
        );

    const production = mapProductionRow(productionInsert.rows[0]);

    if (canUseProductId) {
      for (const material of payload.materials) {
        if (canUseUnitPrice) {
          await client.query(
            `
              INSERT INTO public.production_order_materials (
                production_order_id,
                product_id,
                product_name,
                quantity,
                unit,
                unit_price
              )
              VALUES ($1, $2, $3, $4, $5, $6);
            `,
            [
              production.id,
              material.productId ?? null,
              material.productName,
              material.quantity,
              material.unit,
              toNumber(material.unitPrice ?? 0),
            ],
          );
          continue;
        }

        await client.query(
          `
            INSERT INTO public.production_order_materials (
              production_order_id,
              product_id,
              product_name,
              quantity,
              unit
            )
            VALUES ($1, $2, $3, $4, $5);
          `,
          [
            production.id,
            material.productId ?? null,
            material.productName,
            material.quantity,
            material.unit,
          ],
        );
      }
    } else {
      for (const material of payload.materials) {
        if (canUseUnitPrice) {
          await client.query(
            `
              INSERT INTO public.production_order_materials (
                production_order_id,
                product_name,
                quantity,
                unit,
                unit_price
              )
              VALUES ($1, $2, $3, $4, $5);
            `,
            [
              production.id,
              material.productName,
              material.quantity,
              material.unit,
              toNumber(material.unitPrice ?? 0),
            ],
          );
          continue;
        }

        await client.query(
          `
            INSERT INTO public.production_order_materials (
              production_order_id,
              product_name,
              quantity,
              unit
            )
            VALUES ($1, $2, $3, $4);
          `,
          [production.id, material.productName, material.quantity, material.unit],
        );
      }
    }

    const hasStatusesSchema = await hasProductionStatusesSchema(client);

    if (hasStatusesSchema && payload.installationTeamId) {
      await createStatusAssignment(client, production.id, {
        stageName: "pending",
        teamId: payload.installationTeamId,
      });
    }

    await client.query("COMMIT");

    production.materials = payload.materials.map(normalizeMaterial);
    const fullProduction = await listById(production.id);

    if (fullProduction) {
      return fullProduction;
    }

    return production;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function complete(id: string): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const installationTeamIdSelect = canUseInstallationTeamId
      ? "installation_team_id"
      : "NULL::text AS installation_team_id";

    const currentResult = await client.query<ProductionOrderRow>(
      `
        SELECT
          id::text AS id,
          client_name,
          description,
          production_status,
          completed_at,
          delivery_date,
          ${installationTeamIdSelect},
          installation_team,
          initial_cost
        FROM public.production_orders
        WHERE id = $1
        FOR UPDATE;
      `,
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentProduction = currentResult.rows[0];
    const normalizedCurrentStatus = normalizeProductionStatus(currentProduction.production_status);

    const normalizedLowerStatus = normalizedCurrentStatus.toLowerCase();
    const isAlreadyApproved =
      normalizedLowerStatus.includes("approved") ||
      normalizedLowerStatus.includes("delivered") ||
      Boolean(currentProduction.completed_at);

    let persistedApprovalStatus: ProductionStatus = normalizedCurrentStatus;

    if (!isAlreadyApproved) {
      await deductMaterialsFromStock(client, id);
      persistedApprovalStatus = await updateProductionAsApproved(client, id);
    }

    await client.query("COMMIT");

    const fullProduction = await listById(id);

    if (fullProduction) {
      return fullProduction;
    }

    return {
      ...mapProductionRow(currentProduction),
      productionStatus: isAlreadyApproved ? normalizedCurrentStatus : persistedApprovalStatus,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function hasApprovalKeyword(statusName: string): boolean {
  const normalized = normalizeStageName(statusName);
  return normalized === "approved" || normalized === "aprovado" || normalized === "delivered";
}

async function advanceStatus(id: string, input: AdvanceProductionStatusInput): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hasSchema = await hasProductionStatusesSchema(client);

    if (!hasSchema) {
      throw new AppError(
        "Production statuses schema is not configured. Run sql/20260401_create_production_multi_statuses.sql",
        500,
      );
    }

    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const installationTeamIdSelect = canUseInstallationTeamId
      ? "installation_team_id"
      : "NULL::text AS installation_team_id";

    const currentResult = await client.query<ProductionOrderRow>(
      `
        SELECT
          id::text AS id,
          client_name,
          description,
          production_status,
          completed_at,
          delivery_date,
          ${installationTeamIdSelect},
          installation_team,
          initial_cost
        FROM public.production_orders
        WHERE id = $1
        FOR UPDATE;
      `,
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentProduction = currentResult.rows[0];
    const stage = await resolveStatusStage(client, input);

    const shouldDeductStock =
      hasApprovalKeyword(stage.name) &&
      !hasApprovalKeyword(currentProduction.production_status) &&
      !Boolean(currentProduction.completed_at);

    if (shouldDeductStock) {
      await deductMaterialsFromStock(client, id);
    }

    await createStatusAssignment(client, id, input, stage);

    if (shouldDeductStock) {
      await client.query(
        `
          UPDATE public.production_orders
          SET
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
          WHERE id::text = $1;
        `,
        [id],
      );
    }

    await client.query("COMMIT");

    const fullProduction = await listById(id);

    if (fullProduction) {
      return fullProduction;
    }

    return mapProductionRow(currentProduction);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setStatuses(id: string, input: SetProductionStatusesInput): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hasSchema = await hasProductionStatusesSchema(client);

    if (!hasSchema) {
      throw new AppError(
        "Production statuses schema is not configured. Run sql/20260401_create_production_multi_statuses.sql",
        500,
      );
    }

    const exists = await ensureProductionExistsForUpdate(client, id);

    if (!exists) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        DELETE FROM public.production_order_statuses
        WHERE production_id = $1;
      `,
      [id],
    );

    for (const status of input.statuses) {
      await createStatusAssignment(client, id, status);
    }

    await client.query("COMMIT");

    return listById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const productionRepository = {
  findAll,
  listById,
  listStatusOptions,
  create,
  complete,
  setStatuses,
  advanceStatus,
};
