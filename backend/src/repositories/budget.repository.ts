import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import { Budget, BudgetMaterial, BudgetStatus, CreateBudgetInput } from "../models/budget.model";

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
    const result = await client.query<BudgetRow>(
      `
        UPDATE public.budgets
        SET
          status = 'approved',
          approved_at = COALESCE(approved_at, NOW()),
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
      [id],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return listByIdWithClient(client, id);
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
