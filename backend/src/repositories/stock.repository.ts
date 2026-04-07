import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import {
  CreateStockMovementInput,
  ListStockMovementsQueryInput,
  StockMovement,
  StockMovementList,
  StockMovementType,
} from "../models/stock.model";
import { AppError } from "../utils/app-error";

interface ProductStockRow {
  id: string;
  name: string | null;
  stock_quantity: string | number;
}

interface StockMovementRow {
  id: string;
  product_id: string;
  product_name: string | null;
  movement_type: StockMovementType;
  quantity: string | number;
  unit: string | null;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  current_stock: string | number | null;
  created_at: string | Date;
}

interface CountRow {
  total: string | number;
}

const PRODUCTION_REFERENCE_TYPES = ["production", "production_order"] as const;

function normalizedProductionStatusSql(columnName: string): string {
  return `
    LOWER(
      TRANSLATE(
        COALESCE(${columnName}, ''),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
      )
    )
  `;
}

function activeProductionPredicateSql(columnName: string): string {
  const normalizedStatus = normalizedProductionStatusSql(columnName);

  return `
    ${normalizedStatus} NOT LIKE '%approved%'
    AND ${normalizedStatus} NOT LIKE '%aprovad%'
    AND ${normalizedStatus} NOT LIKE '%delivered%'
    AND ${normalizedStatus} NOT LIKE '%entreg%'
    AND ${normalizedStatus} NOT LIKE '%completed%'
    AND ${normalizedStatus} NOT LIKE '%concluid%'
  `;
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

function mapStockMovementRow(row: StockMovementRow, fallbackProductName?: string): StockMovement {
  const rawName = row.product_name ?? fallbackProductName ?? row.product_id;
  const normalizedReferenceType = row.reference_type
    ? PRODUCTION_REFERENCE_TYPES.includes(row.reference_type as (typeof PRODUCTION_REFERENCE_TYPES)[number])
      ? "production"
      : row.reference_type
    : null;

  return {
    id: row.id,
    productId: row.product_id,
    productName: rawName && rawName.trim().length > 0 ? rawName : row.product_id,
    movementType: row.movement_type,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    reason: row.reason,
    referenceType: normalizedReferenceType,
    referenceId: row.reference_id,
    currentStock: row.current_stock === null ? null : toNumber(row.current_stock),
    createdAt: toDateString(row.created_at),
  };
}

function normalizeSchemaError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError(
      "Stock schema is not configured. Run sql/20260317_add_product_stock_movements.sql",
      500,
    );
  }

  throw error;
}

async function getProductForUpdate(client: PoolClient, productId: string): Promise<ProductStockRow> {
  const result = await client.query<ProductStockRow>(
    `
      SELECT
        id::text AS id,
        name,
        stock_quantity
      FROM public.products
      WHERE id::text = $1
      FOR UPDATE;
    `,
    [productId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Product not found", 404, { productId });
  }

  return result.rows[0];
}

async function listMovements(query: ListStockMovementsQueryInput): Promise<StockMovementList> {
  try {
    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.productId) {
      params.push(query.productId);
      whereClauses.push(`psm.product_id = $${params.length}`);
    }

    if (query.movementType) {
      params.push(query.movementType);
      whereClauses.push(`psm.movement_type = $${params.length}`);
    }

    if (query.referenceType) {
      const normalizedReferenceType = query.referenceType.trim().toLowerCase();

      if (PRODUCTION_REFERENCE_TYPES.includes(normalizedReferenceType as (typeof PRODUCTION_REFERENCE_TYPES)[number])) {
        whereClauses.push(
          `(psm.reference_type = '${PRODUCTION_REFERENCE_TYPES[0]}' OR psm.reference_type = '${PRODUCTION_REFERENCE_TYPES[1]}')`,
        );
      } else {
        params.push(normalizedReferenceType);
        whereClauses.push(`LOWER(psm.reference_type) = $${params.length}`);
      }
    }

    if (query.startDate) {
      params.push(query.startDate);
      whereClauses.push(`psm.created_at >= $${params.length}::date`);
    }

    if (query.endDate) {
      params.push(query.endDate);
      whereClauses.push(`psm.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (query.activeOnly) {
      whereClauses.push(`
        psm.reference_id IS NOT NULL
        AND (psm.reference_type = '${PRODUCTION_REFERENCE_TYPES[0]}' OR psm.reference_type = '${PRODUCTION_REFERENCE_TYPES[1]}')
        AND EXISTS (
          SELECT 1
          FROM public.production_orders po
          WHERE po.id::text = psm.reference_id
            AND ${activeProductionPredicateSql("po.production_status")}
        )
      `);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countResult = await pool.query<CountRow>(
      `
        SELECT COUNT(*) AS total
        FROM public.product_stock_movements psm
        ${whereSql};
      `,
      params,
    );

    const paginationParams = [...params, query.limit, query.offset];
    const limitIndex = paginationParams.length - 1;
    const offsetIndex = paginationParams.length;

    const rowsResult = await pool.query<StockMovementRow>(
      `
        SELECT
          psm.id::text AS id,
          psm.product_id,
          p.name AS product_name,
          psm.movement_type,
          psm.quantity,
          psm.unit,
          psm.reason,
          psm.reference_type,
          psm.reference_id,
          p.stock_quantity AS current_stock,
          psm.created_at
        FROM public.product_stock_movements psm
        LEFT JOIN public.products p
          ON p.id::text = psm.product_id
        ${whereSql}
        ORDER BY psm.created_at DESC, psm.id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex};
      `,
      paginationParams,
    );

    return {
      items: rowsResult.rows.map((row) => mapStockMovementRow(row)),
      total: toNumber(countResult.rows[0]?.total ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function createMovement(payload: CreateStockMovementInput): Promise<StockMovement> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const product = await getProductForUpdate(client, payload.productId);
    const currentStock = toNumber(product.stock_quantity);
    const isInbound = payload.movementType === "entrada";
    const newStock = isInbound ? currentStock + payload.quantity : currentStock - payload.quantity;

    if (newStock < 0) {
      throw new AppError("Insufficient stock for outbound movement", 409, {
        productId: product.id,
        productName: product.name,
        requestedQuantity: payload.quantity,
        availableStock: currentStock,
      });
    }

    await client.query(
      `
        UPDATE public.products
        SET
          stock_quantity = $2,
          updated_at = NOW()
        WHERE id::text = $1;
      `,
      [product.id, newStock],
    );

    const movementResult = await client.query<StockMovementRow>(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id::text AS id,
          product_id,
          NULL::text AS product_name,
          movement_type,
          quantity,
          unit,
          reason,
          reference_type,
          reference_id,
          $8::numeric AS current_stock,
          created_at;
      `,
      [
        product.id,
        payload.movementType,
        payload.quantity,
        payload.unit ?? null,
        payload.reason,
        payload.referenceType ?? null,
        payload.referenceId ?? null,
        newStock,
      ],
    );

    await client.query("COMMIT");

    return mapStockMovementRow(movementResult.rows[0], product.name ?? product.id);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof AppError) {
      throw error;
    }

    normalizeSchemaError(error);
  } finally {
    client.release();
  }
}

export const stockRepository = {
  listMovements,
  createMovement,
};
