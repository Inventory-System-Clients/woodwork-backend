import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import { Budget, BudgetMaterial, BudgetStatus, CreateBudgetInput } from "../models/budget.model";
import { AppError } from "../utils/app-error";

interface BudgetRow {
  id: string;
  client_name: string;
  description: string;
  status: BudgetStatus;
  delivery_date: string | Date | null;
  total_price: string | number;
  notes: string | null;
  approved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface BudgetWithMaterialRow extends BudgetRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number | null;
}

interface BudgetMaterialUsageRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number;
  unit: string | null;
}

interface ProductStockRow {
  id: string;
  stock_quantity: string | number;
}

type BudgetMaterialInput = {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number | null;
};

export type CreateBudgetRecordInput = CreateBudgetInput;

export interface SaveBudgetRecordInput {
  clientName: string;
  description: string;
  status: BudgetStatus;
  deliveryDate: string | null;
  totalPrice: number;
  notes: string | null;
  approvedAt: string | null;
  materials: BudgetMaterial[];
}

let productsTableExists: boolean | null = null;
let productStockQuantityColumnExists: boolean | null = null;
let productStockMovementsTableExists: boolean | null = null;
let productNameColumnExists: boolean | null = null;

function toDateString(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBudgetRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    clientName: row.client_name,
    description: row.description,
    status: row.status,
    deliveryDate: toDateString(row.delivery_date),
    totalPrice: toNumber(row.total_price),
    notes: row.notes,
    approvedAt: toDateString(row.approved_at),
    createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toDateString(row.updated_at) ?? new Date().toISOString(),
    materials: [],
  };
}

function mapMaterialRow(row: BudgetWithMaterialRow): BudgetMaterial | null {
  if (!row.product_name || row.quantity === null || !row.unit) {
    return null;
  }

  const material: BudgetMaterial = {
    productName: row.product_name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price === null ? null : toNumber(row.unit_price),
  };

  if (row.product_id) {
    material.productId = row.product_id;
  }

  return material;
}

function normalizeMaterial(input: BudgetMaterialInput): BudgetMaterial {
  const material: BudgetMaterial = {
    productName: input.productName,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice ?? null,
  };

  if (input.productId) {
    material.productId = input.productId;
  }

  return material;
}

function groupRows(rows: BudgetWithMaterialRow[]): Budget[] {
  const budgetsById = new Map<string, Budget>();

  for (const row of rows) {
    const existing = budgetsById.get(row.id);

    if (!existing) {
      budgetsById.set(row.id, mapBudgetRow(row));
    }

    const material = mapMaterialRow(row);

    if (material) {
      budgetsById.get(row.id)?.materials.push(material);
    }
  }

  return [...budgetsById.values()];
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

async function resolveProductIdForBudgetMaterial(
  client: PoolClient,
  budgetId: string,
  material: BudgetMaterialUsageRow,
): Promise<string> {
  if (material.product_id && material.product_id.trim().length > 0) {
    return material.product_id.trim();
  }

  if (!material.product_name || material.product_name.trim().length === 0) {
    throw new AppError("Cannot resolve product for stock deduction", 400, {
      budgetId,
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
      budgetId,
      productName: material.product_name,
    });
  }

  if (productByNameResult.rows.length > 1) {
    throw new AppError("Multiple products found for material name", 409, {
      budgetId,
      productName: material.product_name,
    });
  }

  return productByNameResult.rows[0].id;
}

async function deductBudgetMaterialsFromStock(client: PoolClient, budgetId: string): Promise<void> {
  await ensureStockControlSchema(client);

  const materialsResult = await client.query<BudgetMaterialUsageRow>(
    `
      SELECT
        bm.product_id,
        bm.product_name,
        SUM(bm.quantity) AS quantity,
        MAX(bm.unit) AS unit
      FROM public.budget_materials bm
      WHERE bm.budget_id = $1
      GROUP BY bm.product_id, bm.product_name;
    `,
    [budgetId],
  );

  for (const material of materialsResult.rows) {
    const quantityToDeduct = toNumber(material.quantity);
    const resolvedProductId = await resolveProductIdForBudgetMaterial(client, budgetId, material);

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
          budgetId,
          productId: resolvedProductId,
          productName: material.product_name,
        });
      }

      throw new AppError("Insufficient stock to approve budget", 409, {
        budgetId,
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
        VALUES ($1, 'saida', $2, $3, $4, 'budget', $5);
      `,
      [resolvedProductId, quantityToDeduct, material.unit, "Automatic outbound movement from budget approval", budgetId],
    );
  }
}

async function listByIdWithClient(client: PoolClient, id: string): Promise<Budget | undefined> {
  const result = await client.query<BudgetWithMaterialRow>(
    `
      SELECT
        b.id,
        b.client_name,
        b.description,
        b.status,
        b.delivery_date,
        b.total_price,
        b.notes,
        b.approved_at,
        b.created_at,
        b.updated_at,
        bm.product_id,
        bm.product_name,
        bm.quantity,
        bm.unit,
        bm.unit_price
      FROM public.budgets b
      LEFT JOIN public.budget_materials bm
        ON bm.budget_id = b.id
      WHERE b.id = $1
      ORDER BY bm.id ASC;
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  return groupRows(result.rows)[0];
}

async function findAll(): Promise<Budget[]> {
  const result = await pool.query<BudgetWithMaterialRow>(
    `
      SELECT
        b.id,
        b.client_name,
        b.description,
        b.status,
        b.delivery_date,
        b.total_price,
        b.notes,
        b.approved_at,
        b.created_at,
        b.updated_at,
        bm.product_id,
        bm.product_name,
        bm.quantity,
        bm.unit,
        bm.unit_price
      FROM public.budgets b
      LEFT JOIN public.budget_materials bm
        ON bm.budget_id = b.id
      ORDER BY b.created_at DESC, bm.id ASC;
    `,
  );

  return groupRows(result.rows);
}

async function findById(id: string): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    return await listByIdWithClient(client, id);
  } finally {
    client.release();
  }
}

async function insertMaterials(client: PoolClient, budgetId: string, materials: BudgetMaterial[]): Promise<void> {
  for (const material of materials) {
    await client.query(
      `
        INSERT INTO public.budget_materials (
          budget_id,
          product_id,
          product_name,
          quantity,
          unit,
          unit_price
        )
        VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [
        budgetId,
        material.productId ?? null,
        material.productName,
        material.quantity,
        material.unit,
        material.unitPrice,
      ],
    );
  }
}

async function create(payload: CreateBudgetRecordInput): Promise<Budget> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const budgetId = randomUUID();

    await client.query(
      `
        INSERT INTO public.budgets (
          id,
          client_name,
          description,
          status,
          delivery_date,
          total_price,
          notes,
          approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $4 = 'approved' THEN NOW() ELSE NULL END);
      `,
      [
        budgetId,
        payload.clientName,
        payload.description,
        payload.status,
        payload.deliveryDate ?? null,
        payload.totalPrice,
        payload.notes ?? null,
      ],
    );

    const normalizedMaterials = payload.materials.map(normalizeMaterial);

    await insertMaterials(client, budgetId, normalizedMaterials);

    await client.query("COMMIT");

    const budget = await listByIdWithClient(client, budgetId);

    if (!budget) {
      throw new Error("Budget was not found after creation");
    }

    return budget;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function save(id: string, payload: SaveBudgetRecordInput): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updateResult = await client.query<BudgetRow>(
      `
        UPDATE public.budgets
        SET
          client_name = $2,
          description = $3,
          status = $4,
          delivery_date = $5,
          total_price = $6,
          notes = $7,
          approved_at = $8,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          client_name,
          description,
          status,
          delivery_date,
          total_price,
          notes,
          approved_at,
          created_at,
          updated_at;
      `,
      [
        id,
        payload.clientName,
        payload.description,
        payload.status,
        payload.deliveryDate,
        payload.totalPrice,
        payload.notes,
        payload.approvedAt,
      ],
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        DELETE FROM public.budget_materials
        WHERE budget_id = $1;
      `,
      [id],
    );

    await insertMaterials(client, id, payload.materials);

    await client.query("COMMIT");

    return listByIdWithClient(client, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function approve(id: string): Promise<Budget | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<BudgetRow>(
      `
        SELECT
          id,
          client_name,
          description,
          status,
          delivery_date,
          total_price,
          notes,
          approved_at,
          created_at,
          updated_at
        FROM public.budgets
        WHERE id = $1
        FOR UPDATE;
      `,
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentBudget = currentResult.rows[0];

    if (currentBudget.status !== "approved") {
      await deductBudgetMaterialsFromStock(client, id);

      await client.query(
        `
          UPDATE public.budgets
          SET
            status = 'approved',
            approved_at = COALESCE(approved_at, NOW()),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [id],
      );
    }

    await client.query("COMMIT");

    return listByIdWithClient(client, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const budgetRepository = {
  findAll,
  findById,
  create,
  save,
  approve,
};
