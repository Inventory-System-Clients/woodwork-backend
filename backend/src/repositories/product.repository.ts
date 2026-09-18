import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { CreateProductInput, Product } from "../models/product.model";
import { AppError } from "../utils/app-error";

interface ProductRow {
  id: string;
  name: string | null;
  supplier: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

let supplierColumnKnownToExist = false;

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name && row.name.trim().length > 0 ? row.name : row.id,
    supplier: row.supplier && row.supplier.trim().length > 0 ? row.supplier : null,
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

// The supplier column comes from a newer migration; keep the app working until it is applied.
async function hasSupplierColumn(): Promise<boolean> {
  if (supplierColumnKnownToExist) {
    return true;
  }

  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'supplier'
      ) AS exists;
    `,
  );

  supplierColumnKnownToExist = Boolean(result.rows[0]?.exists);
  return supplierColumnKnownToExist;
}

async function ensureSupplierColumnFor(supplier: string | null | undefined): Promise<boolean> {
  const hasColumn = await hasSupplierColumn();

  if (!hasColumn && supplier) {
    throw new AppError("Products supplier column is not configured. Run sql/20260918_add_supplier_to_products.sql", 500);
  }

  return hasColumn;
}

async function selectColumns(): Promise<string> {
  const supplierSelect = (await hasSupplierColumn()) ? "supplier" : "NULL::text AS supplier";

  return `
    id::text AS id,
    name,
    ${supplierSelect},
    created_at,
    updated_at
  `;
}

async function findAll(search?: string): Promise<Product[]> {
  try {
    const searchBySupplier = (await hasSupplierColumn())
      ? "OR LOWER(COALESCE(supplier, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')"
      : "";

    const result = await pool.query<ProductRow>(
      `
        SELECT ${await selectColumns()}
        FROM public.products
        WHERE (
          $1::text IS NULL
          OR LOWER(COALESCE(name, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
          ${searchBySupplier}
        )
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
        SELECT ${await selectColumns()}
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
        SELECT ${await selectColumns()}
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
  const hasColumn = await ensureSupplierColumnFor(payload.supplier);

  try {
    // The stock columns of older databases keep their DEFAULT 0 and are simply not used anymore.
    const result = hasColumn
      ? await pool.query<ProductRow>(
          `
            INSERT INTO public.products (id, name, supplier)
            VALUES ($1, $2, $3)
            RETURNING ${await selectColumns()};
          `,
          [randomUUID(), payload.name, payload.supplier ?? null],
        )
      : await pool.query<ProductRow>(
          `
            INSERT INTO public.products (id, name)
            VALUES ($1, $2)
            RETURNING ${await selectColumns()};
          `,
          [randomUUID(), payload.name],
        );

    return mapProductRow(result.rows[0]);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function update(id: string, payload: { name: string; supplier: string | null }): Promise<Product | undefined> {
  const hasColumn = await ensureSupplierColumnFor(payload.supplier);

  try {
    const result = hasColumn
      ? await pool.query<ProductRow>(
          `
            UPDATE public.products
            SET
              name = $2,
              supplier = $3,
              updated_at = NOW()
            WHERE id::text = $1
            RETURNING ${await selectColumns()};
          `,
          [id, payload.name, payload.supplier],
        )
      : await pool.query<ProductRow>(
          `
            UPDATE public.products
            SET
              name = $2,
              updated_at = NOW()
            WHERE id::text = $1
            RETURNING ${await selectColumns()};
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
