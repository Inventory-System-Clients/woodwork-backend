import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import {
  PublicProductionMaterial,
  PublicProductionView,
} from "../models/production-share.model";
import { ProductionStatus, productionStatusFlow } from "../models/production.model";
import { AppError } from "../utils/app-error";

interface ProductionExistsRow {
  id: string;
}

interface ProductionShareLinkRow {
  id: string;
  production_id: string;
  expires_at: string | Date | null;
}

interface PublicProductionRow {
  share_link_id: string;
  production_id: string;
  client_name: string;
  description: string;
  production_status: string;
  delivery_date: string | Date | null;
  installation_team: string | null;
  updated_at: string | Date;
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
}

interface CreateProductionShareLinkInput {
  productionId: string;
  tokenHash: string;
  createdByUserId: string;
  expiresAt: Date;
}

const STATUS_ALIASES: Record<string, ProductionStatus> = {
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

  return value instanceof Date ? value.toISOString() : value;
}

function normalizeProductionStatus(status: string): ProductionStatus {
  const normalizedStatus = status.trim().toLowerCase();

  if (productionStatusFlow.includes(normalizedStatus as ProductionStatus)) {
    return normalizedStatus as ProductionStatus;
  }

  return STATUS_ALIASES[normalizedStatus] ?? "pending";
}

function normalizeSchemaError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError(
      "Production share schema is not configured. Run sql/20260318_create_production_share_links.sql",
      500,
    );
  }

  throw error;
}

async function findProductionById(client: PoolClient, productionId: string): Promise<ProductionExistsRow | undefined> {
  const result = await client.query<ProductionExistsRow>(
    `
      SELECT id::text AS id
      FROM public.production_orders
      WHERE id::text = $1
      FOR UPDATE;
    `,
    [productionId],
  );

  return result.rows[0];
}

async function createShareLink(input: CreateProductionShareLinkInput): Promise<ProductionShareLinkRow | undefined> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const production = await findProductionById(client, input.productionId);

    if (!production) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        UPDATE public.production_share_links
        SET
          revoked_at = NOW()
        WHERE production_id = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW());
      `,
      [input.productionId],
    );

    const result = await client.query<ProductionShareLinkRow>(
      `
        INSERT INTO public.production_share_links (
          id,
          production_id,
          token_hash,
          created_by_user_id,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          production_id,
          expires_at;
      `,
      [randomUUID(), input.productionId, input.tokenHash, input.createdByUserId, input.expiresAt],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    normalizeSchemaError(error);
  } finally {
    client.release();
  }
}

function mapMaterialRow(row: PublicProductionRow): PublicProductionMaterial | null {
  if (row.quantity === null || row.unit === null || row.product_name === null) {
    return null;
  }

  const material: PublicProductionMaterial = {
    productName: row.product_name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
  };

  if (row.product_id) {
    material.productId = row.product_id;
  }

  return material;
}

function mapProductionRows(rows: PublicProductionRow[]): PublicProductionView | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  const firstRow = rows[0];

  const production: PublicProductionView = {
    id: firstRow.production_id,
    clientName: firstRow.client_name,
    description: firstRow.description,
    productionStatus: normalizeProductionStatus(firstRow.production_status),
    deliveryDate: toDateString(firstRow.delivery_date),
    installationTeam: firstRow.installation_team,
    materials: [],
    observations: firstRow.description,
    updatedAt: toDateString(firstRow.updated_at) ?? new Date().toISOString(),
  };

  for (const row of rows) {
    const material = mapMaterialRow(row);

    if (material) {
      production.materials.push(material);
    }
  }

  return production;
}

async function findPublicProductionByTokenHash(tokenHash: string): Promise<PublicProductionView | undefined> {
  try {
    const result = await pool.query<PublicProductionRow>(
      `
        SELECT
          psl.id AS share_link_id,
          po.id::text AS production_id,
          po.client_name,
          po.description,
          po.production_status::text AS production_status,
          po.delivery_date,
          po.installation_team,
          po.updated_at,
          pom.product_id,
          pom.product_name,
          pom.quantity,
          pom.unit
        FROM public.production_share_links psl
        INNER JOIN public.production_orders po
          ON po.id::text = psl.production_id
        LEFT JOIN public.production_order_materials pom
          ON pom.production_order_id = po.id
        WHERE psl.token_hash = $1
          AND psl.revoked_at IS NULL
          AND (psl.expires_at IS NULL OR psl.expires_at > NOW())
        ORDER BY pom.id ASC;
      `,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const shareLinkId = result.rows[0].share_link_id;

    await pool.query(
      `
        UPDATE public.production_share_links
        SET last_accessed_at = NOW()
        WHERE id = $1;
      `,
      [shareLinkId],
    );

    return mapProductionRows(result.rows);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

export const productionShareRepository = {
  createShareLink,
  findPublicProductionByTokenHash,
};
