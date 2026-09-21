import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import { ProductionExpense, ProductionExpenseInput, UpdateProductionExpenseInput } from "../models/production.model";
import { AppError } from "../utils/app-error";

interface ProductionExpenseRow {
  id: string;
  production_id: string;
  description: string;
  category: string | null;
  amount: string | number;
  created_at: string | Date;
}

const EXPENSE_COLUMNS = "id, production_id, description, category, amount, created_at";

function mapRow(row: ProductionExpenseRow): ProductionExpense {
  const amount = Number(row.amount);

  return {
    id: row.id,
    productionId: row.production_id,
    description: row.description,
    category: row.category,
    amount: Number.isFinite(amount) ? amount : 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function hasExpensesTable(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.production_expenses') IS NOT NULL AS exists;",
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureExpensesTable(client: PoolClient): Promise<void> {
  if (!(await hasExpensesTable(client))) {
    throw new AppError(
      "Production expenses schema is not configured. Run sql/20260918_create_production_expenses.sql",
      500,
    );
  }
}

async function insertExpense(
  client: PoolClient,
  productionId: string,
  input: ProductionExpenseInput,
): Promise<ProductionExpense> {
  await ensureExpensesTable(client);

  const result = await client.query<ProductionExpenseRow>(
    `
      INSERT INTO public.production_expenses (id, production_id, description, category, amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${EXPENSE_COLUMNS};
    `,
    [randomUUID(), productionId, input.description, input.category?.trim() || null, input.amount],
  );

  return mapRow(result.rows[0]);
}

async function listByProductionId(productionId: string): Promise<ProductionExpense[]> {
  const client = await pool.connect();

  try {
    if (!(await hasExpensesTable(client))) {
      return [];
    }

    const result = await client.query<ProductionExpenseRow>(
      `
        SELECT ${EXPENSE_COLUMNS}
        FROM public.production_expenses
        WHERE production_id = $1
        ORDER BY created_at ASC;
      `,
      [productionId],
    );

    return result.rows.map(mapRow);
  } finally {
    client.release();
  }
}

async function create(productionId: string, input: ProductionExpenseInput): Promise<ProductionExpense> {
  const client = await pool.connect();

  try {
    return await insertExpense(client, productionId, input);
  } finally {
    client.release();
  }
}

async function remove(productionId: string, expenseId: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    if (!(await hasExpensesTable(client))) {
      return false;
    }

    const result = await client.query(
      "DELETE FROM public.production_expenses WHERE id = $1 AND production_id = $2;",
      [expenseId, productionId],
    );

    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

async function update(
  productionId: string,
  expenseId: string,
  input: UpdateProductionExpenseInput,
): Promise<ProductionExpense | undefined> {
  const columns: [string, unknown][] = [];

  if (input.description !== undefined) columns.push(["description", input.description]);
  if (input.category !== undefined) columns.push(["category", input.category?.trim() || null]);
  if (input.amount !== undefined) columns.push(["amount", input.amount]);

  const values = columns.map(([, value]) => value);
  values.push(expenseId, productionId);

  const client = await pool.connect();

  try {
    await ensureExpensesTable(client);

    const result = await client.query<ProductionExpenseRow>(
      `
        UPDATE public.production_expenses
        SET ${columns.map(([column], index) => `${column} = $${index + 1}`).join(", ")}
        WHERE id = $${columns.length + 1} AND production_id = $${columns.length + 2}
        RETURNING ${EXPENSE_COLUMNS};
      `,
      values,
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  } finally {
    client.release();
  }
}

export const productionExpenseRepository = {
  update,
  insertExpense,
  listByProductionId,
  create,
  remove,
};
