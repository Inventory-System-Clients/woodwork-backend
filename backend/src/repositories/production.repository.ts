import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import { CreateProductionInput, Production, ProductionMaterial } from "../models/production.model";
import { AppError } from "../utils/app-error";

type CreateProductionRepositoryInput = CreateProductionInput & {
  installationTeam: string | null;
};

interface ProductionOrderRow {
  id: string;
  client_name: string;
  description: string;
  production_status: string;
  delivery_date: string | Date | null;
  installation_team_id: string | null;
  installation_team: string | null;
  initial_cost: string | number;
}

interface ProductionWithMaterialRow extends ProductionOrderRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
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
let installationTeamIdColumnExists: boolean | null = null;
let teamMembersTableExists: boolean | null = null;
let productsTableExists: boolean | null = null;
let productStockQuantityColumnExists: boolean | null = null;
let productStockMovementsTableExists: boolean | null = null;

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

function mapProductionRow(row: ProductionOrderRow): Production {
  return {
    id: row.id,
    clientName: row.client_name,
    description: row.description,
    productionStatus: row.production_status,
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

async function deductMaterialsFromStock(client: PoolClient, productionOrderId: string): Promise<void> {
  const canUseProductId = await hasProductIdColumn(client);

  if (!canUseProductId) {
    throw new AppError(
      "Stock deduction requires production_order_materials.product_id. Run sql/20260316_add_product_id_to_production_order_materials.sql",
      500,
    );
  }

  const missingProductIdResult = await client.query<{ missing_count: string | number }>(
    `
      SELECT COUNT(*)::int AS missing_count
      FROM public.production_order_materials
      WHERE production_order_id = $1
        AND (product_id IS NULL OR BTRIM(product_id) = '');
    `,
    [productionOrderId],
  );

  if (toNumber(missingProductIdResult.rows[0]?.missing_count ?? 0) > 0) {
    throw new AppError("Cannot complete production with materials that do not have productId", 400);
  }

  await ensureStockControlSchema(client);

  const materialsResult = await client.query<ProductionMaterialUsageRow>(
    `
      SELECT
        pom.product_id,
        MAX(pom.product_name) AS product_name,
        SUM(pom.quantity) AS quantity,
        MAX(pom.unit) AS unit
      FROM public.production_order_materials pom
      WHERE pom.production_order_id = $1
        AND pom.product_id IS NOT NULL
      GROUP BY pom.product_id;
    `,
    [productionOrderId],
  );

  for (const material of materialsResult.rows) {
    const quantityToDeduct = toNumber(material.quantity);

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
      [quantityToDeduct, material.product_id],
    );

    if (stockUpdateResult.rows.length === 0) {
      const productResult = await client.query<{ stock_quantity: string | number }>(
        `
          SELECT stock_quantity
          FROM public.products
          WHERE id::text = $1;
        `,
        [material.product_id],
      );

      if (productResult.rows.length === 0) {
        throw new AppError("Material product was not found in products table", 400, {
          productionOrderId,
          productId: material.product_id,
          productName: material.product_name,
        });
      }

      throw new AppError("Insufficient stock to complete production", 409, {
        productionOrderId,
        productId: material.product_id,
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
        material.product_id,
        quantityToDeduct,
        material.unit,
        "Automatic outbound movement from production completion",
        productionOrderId,
      ],
    );
  }
}

async function listById(id: string): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";
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
          pom.unit
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

    return groupRows(result.rows)[0];
  } finally {
    client.release();
  }
}

async function findAll(employeeId?: string): Promise<Production[]> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const canUseInstallationTeamId = await hasInstallationTeamIdColumn(client);
    const canUseTeamMembersTable = await hasTeamMembersTable(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";
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
          pom.unit
        FROM public.production_orders po
        ${employeeJoin}
        LEFT JOIN public.production_order_materials pom
          ON pom.production_order_id = po.id
        ${employeeWhere}
        ORDER BY po.created_at DESC, pom.id ASC;
      `,
      employeeId ? [employeeId] : undefined,
    );

    return groupRows(result.rows);
  } finally {
    client.release();
  }
}

async function create(payload: CreateProductionRepositoryInput): Promise<Production> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const canUseProductId = await hasProductIdColumn(client);
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

    await client.query("COMMIT");

    production.materials = payload.materials.map(normalizeMaterial);
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

    if (currentProduction.production_status !== "delivered") {
      await deductMaterialsFromStock(client, id);

      await client.query(
        `
          UPDATE public.production_orders
          SET
            production_status = 'delivered',
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [id],
      );
    }

    await client.query("COMMIT");

    const fullProduction = await listById(id);

    if (fullProduction) {
      return fullProduction;
    }

    return {
      ...mapProductionRow(currentProduction),
      productionStatus: "delivered",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const productionRepository = {
  findAll,
  create,
  complete,
};
