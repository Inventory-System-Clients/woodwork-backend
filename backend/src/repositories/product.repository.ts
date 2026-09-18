import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { CreateProductInput, Product } from "../models/product.model";
import { AppError } from "../utils/app-error";

interface ProductRow {
  id: string;
  name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

const PRODUCT_COLUMNS = `
  id::text AS id,
  name,
  created_at,
  updated_at
`;

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name && row.name.trim().length > 0 ? row.name : row.id,
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function normalizeSchemaError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError("Products schema is not configured. Run sql/20260317_add_product_stock_movements.sql", 500);
  }

  throw error;
}

async function findAll(search?: string): Promise<Product[]> {
  try {
    const result = await pool.query<ProductRow>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM public.products
        WHERE ($1::text IS NULL OR LOWER(COALESCE(name, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%'))
        ORDER BY LOWER(COALESCE(name, id::text)) ASC, created_at DESC;
      `,
      [search ?? null],
    );

    return result.rows.map(mapProductRow);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function findById(id: string): Promise<Product | undefined> {
  try {
    const result = await pool.query<ProductRow>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM public.products
        WHERE id::text = $1;
      `,
      [id],
    );

    return result.rows[0] ? mapProductRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function findByName(name: string): Promise<Product | undefined> {
  try {
    const result = await pool.query<ProductRow>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM public.products
        WHERE LOWER(BTRIM(COALESCE(name, ''))) = LOWER(BTRIM($1))
        LIMIT 1;
      `,
      [name],
    );

    return result.rows[0] ? mapProductRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function create(payload: CreateProductInput): Promise<Product> {
  try {
    // The stock columns of older databases keep their DEFAULT 0 and are simply not used anymore.
    const result = await pool.query<ProductRow>(
      `
        INSERT INTO public.products (id, name)
        VALUES ($1, $2)
        RETURNING ${PRODUCT_COLUMNS};
      `,
      [randomUUID(), payload.name],
    );

    return mapProductRow(result.rows[0]);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function update(id: string, payload: { name: string }): Promise<Product | undefined> {
  try {
    const result = await pool.query<ProductRow>(
      `
        UPDATE public.products
        SET
          name = $2,
          updated_at = NOW()
        WHERE id::text = $1
        RETURNING ${PRODUCT_COLUMNS};
      `,
      [id, payload.name],
    );

    return result.rows[0] ? mapProductRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

export const productRepository = {
  findAll,
  findById,
  findByName,
  create,
  update,
};
