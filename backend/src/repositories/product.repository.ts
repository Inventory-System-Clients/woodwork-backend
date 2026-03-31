import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { CreateProductInput, Product } from "../models/product.model";
import { AppError } from "../utils/app-error";

interface ProductRow {
  id: string;
  name: string | null;
  stock_quantity: string | number;
  low_stock_alert_quantity: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface SaveProductInput {
  name: string;
  lowStockAlertQuantity: number;
}

function toNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapProductRow(row: ProductRow): Product {
  const stockQuantity = toNumber(row.stock_quantity);

  return {
    id: row.id,
    name: row.name && row.name.trim().length > 0 ? row.name : row.id,
    stockQuantity,
    lowStockAlertQuantity: toNumber(row.low_stock_alert_quantity),
    stockStatus: stockQuantity <= 0 ? "precisa_comprar" : "em_estoque",
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function normalizeSchemaError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError(
      "Products schema is not configured. Run sql/20260317_add_product_stock_movements.sql and sql/20260318_add_low_stock_alert_to_products.sql",
      500,
    );
  }

  throw error;
}

async function findAll(search?: string): Promise<Product[]> {
  try {
    const result = await pool.query<ProductRow>(
      `
        SELECT
          id::text AS id,
          name,
          stock_quantity,
          low_stock_alert_quantity,
          created_at,
          updated_at
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
        SELECT
          id::text AS id,
          name,
          stock_quantity,
          low_stock_alert_quantity,
          created_at,
          updated_at
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
        SELECT
          id::text AS id,
          name,
          stock_quantity,
          low_stock_alert_quantity,
          created_at,
          updated_at
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<ProductRow>(
      `
        INSERT INTO public.products (
          id,
          name,
          stock_quantity,
          low_stock_alert_quantity
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id::text AS id,
          name,
          stock_quantity,
          low_stock_alert_quantity,
          created_at,
          updated_at;
      `,
      [randomUUID(), payload.name, payload.stockQuantity, payload.lowStockAlertQuantity],
    );

    const product = mapProductRow(result.rows[0]);

    if (payload.stockQuantity > 0) {
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
          VALUES ($1, 'entrada', $2, NULL, $3, 'product', $4);
        `,
        [product.id, payload.stockQuantity, "Initial stock on product creation", product.id],
      );
    }

    await client.query("COMMIT");
    return product;
  } catch (error) {
    await client.query("ROLLBACK");
    normalizeSchemaError(error);
  } finally {
    client.release();
  }
}

async function update(id: string, payload: SaveProductInput): Promise<Product | undefined> {
  try {
    const result = await pool.query<ProductRow>(
      `
        UPDATE public.products
        SET
          name = $2,
          low_stock_alert_quantity = $3,
          updated_at = NOW()
        WHERE id::text = $1
        RETURNING
          id::text AS id,
          name,
          stock_quantity,
          low_stock_alert_quantity,
          created_at,
          updated_at;
      `,
      [id, payload.name, payload.lowStockAlertQuantity],
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
