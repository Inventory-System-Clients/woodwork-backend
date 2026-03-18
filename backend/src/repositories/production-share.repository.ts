import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import {
  ProductionImage,
  ProductionImageUploadInput,
  PublicProductionImage,
  PublicProductionImageFile,
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

interface ProductionImageRow {
  id: string;
  production_id: string;
  file_name: string;
  mime_type: string;
  file_size: string | number;
  created_at: string | Date;
}

interface ProductionImageFileRow extends ProductionImageRow {
  image_data: Buffer;
}

interface CreateProductionShareLinkInput {
  productionId: string;
  tokenHash: string;
  createdByUserId: string;
  expiresAt: Date;
}

interface CreateProductionImagesInput {
  productionId: string;
  createdByUserId: string;
  images: ProductionImageUploadInput[];
}

let productionOrderMaterialsProductIdColumnExists: boolean | null = null;
let productionImagesTableExists: boolean | null = null;

interface DatabaseErrorLike {
  code?: string;
  message?: string;
  detail?: string;
  hint?: string;
  schema?: string;
  table?: string;
  column?: string;
  constraint?: string;
  routine?: string;
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

function tokenHashPrefix(value: string): string {
  return value.slice(0, 12);
}

function toDatabaseErrorLike(error: unknown): DatabaseErrorLike {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  return error as DatabaseErrorLike;
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

  return value instanceof Date ? value.toISOString() : value;
}

function normalizeProductionStatus(status: string): ProductionStatus {
  const normalizedStatus = status.trim().toLowerCase();

  if (productionStatusFlow.includes(normalizedStatus as ProductionStatus)) {
    return normalizedStatus as ProductionStatus;
  }

  return STATUS_ALIASES[normalizedStatus] ?? "pending";
}

function mapProductionImageRow(row: ProductionImageRow): ProductionImage {
  return {
    id: row.id,
    productionId: row.production_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: toNumber(row.file_size),
    createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
  };
}

function mapPublicProductionImageRow(row: ProductionImageRow): PublicProductionImage {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: toNumber(row.file_size),
    createdAt: toDateString(row.created_at) ?? new Date().toISOString(),
  };
}

function mapPublicProductionImageFileRow(row: ProductionImageFileRow): PublicProductionImageFile {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: toNumber(row.file_size),
    data: row.image_data,
  };
}

function isSchemaError(error: unknown): boolean {
  const dbError = toDatabaseErrorLike(error);
  return dbError.code === "42P01" || dbError.code === "42703";
}

function referencesProductionImagesSchema(error: unknown): boolean {
  const dbError = toDatabaseErrorLike(error);
  const message = (dbError.message ?? "").toLowerCase();
  const table = (dbError.table ?? "").toLowerCase();
  const column = (dbError.column ?? "").toLowerCase();

  return (
    table === "production_images" ||
    message.includes("production_images") ||
    column === "image_data" ||
    message.includes("image_data")
  );
}

function normalizeSchemaError(error: unknown): never {
  const dbError = toDatabaseErrorLike(error);
  const code = dbError.code;

  if (code === "42P01" || code === "42703") {
    throw new AppError(
      "Production share schema is out of date. Run pending SQL migrations.",
      500,
      {
        code: dbError.code,
        table: dbError.table ?? null,
        column: dbError.column ?? null,
        suggestedMigrations: [
          "sql/20260318_create_production_share_links.sql",
          "sql/20260316_add_product_id_to_production_order_materials.sql",
        ],
      },
    );
  }

  throw error;
}

function normalizeImagesSchemaError(error: unknown): never {
  const dbError = toDatabaseErrorLike(error);

  if (dbError.code === "42P01" || dbError.code === "42703") {
    throw new AppError("Production images schema is not configured. Run sql/20260318_create_production_images.sql", 500, {
      code: dbError.code,
      table: dbError.table ?? null,
      column: dbError.column ?? null,
      suggestedMigrations: ["sql/20260318_create_production_images.sql"],
    });
  }

  throw error;
}

async function hasProductionOrderMaterialsProductIdColumn(): Promise<boolean> {
  if (productionOrderMaterialsProductIdColumnExists !== null) {
    return productionOrderMaterialsProductIdColumnExists;
  }

  const result = await pool.query<{ exists: boolean }>(
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

  productionOrderMaterialsProductIdColumnExists = Boolean(result.rows[0]?.exists);
  return productionOrderMaterialsProductIdColumnExists;
}

async function hasProductionImagesTable(): Promise<boolean> {
  if (productionImagesTableExists !== null) {
    return productionImagesTableExists;
  }

  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'production_images'
      ) AS exists;
    `,
  );

  productionImagesTableExists = Boolean(result.rows[0]?.exists);
  return productionImagesTableExists;
}

async function ensureProductionImagesSchema(client: PoolClient): Promise<void> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'production_images'
      ) AS exists;
    `,
  );

  const exists = Boolean(result.rows[0]?.exists);
  productionImagesTableExists = exists;

  if (!exists) {
    throw new AppError("Production images schema is not configured. Run sql/20260318_create_production_images.sql", 500);
  }
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

async function findProductionByIdWithoutLock(
  client: PoolClient,
  productionId: string,
): Promise<ProductionExistsRow | undefined> {
  const result = await client.query<ProductionExistsRow>(
    `
      SELECT id::text AS id
      FROM public.production_orders
      WHERE id::text = $1;
    `,
    [productionId],
  );

  return result.rows[0];
}

async function createShareLink(input: CreateProductionShareLinkInput): Promise<ProductionShareLinkRow | undefined> {
  const client = await pool.connect();

  try {
    console.info("[production-share][repository][createShareLink] Starting", {
      productionId: input.productionId,
      createdByUserId: input.createdByUserId,
      tokenHashPrefix: tokenHashPrefix(input.tokenHash),
      expiresAt: input.expiresAt.toISOString(),
    });

    await client.query("BEGIN");

    const production = await findProductionById(client, input.productionId);

    if (!production) {
      console.warn("[production-share][repository][createShareLink] Production not found", {
        productionId: input.productionId,
      });
      await client.query("ROLLBACK");
      return undefined;
    }

    const revokeResult = await client.query(
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

    console.info("[production-share][repository][createShareLink] Previous active links revoked", {
      productionId: input.productionId,
      revokedCount: revokeResult.rowCount ?? 0,
    });

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
    console.info("[production-share][repository][createShareLink] Link created", {
      productionId: input.productionId,
      shareLinkId: result.rows[0]?.id,
      expiresAt: toDateString(result.rows[0]?.expires_at ?? null),
    });
    return result.rows[0];
  } catch (error) {
    const dbError = toDatabaseErrorLike(error);

    console.error("[production-share][repository][createShareLink] Failed", {
      productionId: input.productionId,
      createdByUserId: input.createdByUserId,
      tokenHashPrefix: tokenHashPrefix(input.tokenHash),
      code: dbError.code,
      message: dbError.message,
      detail: dbError.detail,
      hint: dbError.hint,
      schema: dbError.schema,
      table: dbError.table,
      column: dbError.column,
      constraint: dbError.constraint,
      routine: dbError.routine,
    });

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[production-share][repository][createShareLink] Rollback failed", {
        productionId: input.productionId,
        message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }

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
    images: [],
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

async function findPublicImagesByProductionId(productionId: string): Promise<PublicProductionImage[]> {
  const hasImagesTable = await hasProductionImagesTable();

  if (!hasImagesTable) {
    return [];
  }

  try {
    const result = await pool.query<ProductionImageRow>(
      `
        SELECT
          id,
          production_id,
          file_name,
          mime_type,
          file_size,
          created_at
        FROM public.production_images
        WHERE production_id = $1
        ORDER BY created_at ASC;
      `,
      [productionId],
    );

    return result.rows.map(mapPublicProductionImageRow);
  } catch (error) {
    if (isSchemaError(error) && referencesProductionImagesSchema(error)) {
      console.warn("[production-share][repository][findPublicImagesByProductionId] Images schema unavailable, returning empty list", {
        productionId,
      });
      productionImagesTableExists = false;
      return [];
    }

    throw error;
  }
}

async function findPublicProductionByTokenHash(tokenHash: string): Promise<PublicProductionView | undefined> {
  try {
    const canUseProductId = await hasProductionOrderMaterialsProductIdColumn();
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";

    console.info("[production-share][repository][findPublicByTokenHash] Querying shared production", {
      tokenHashPrefix: tokenHashPrefix(tokenHash),
      canUseProductId,
    });

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
          ${productIdSelect},
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
        ORDER BY pom.product_name ASC NULLS LAST;
      `,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      console.warn("[production-share][repository][findPublicByTokenHash] Token not found/expired/revoked", {
        tokenHashPrefix: tokenHashPrefix(tokenHash),
      });
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

    const mappedProduction = mapProductionRows(result.rows);

    if (mappedProduction) {
      mappedProduction.images = await findPublicImagesByProductionId(mappedProduction.id);
    }

    console.info("[production-share][repository][findPublicByTokenHash] Shared production loaded", {
      tokenHashPrefix: tokenHashPrefix(tokenHash),
      shareLinkId,
      productionId: mappedProduction?.id,
      materialsCount: mappedProduction?.materials.length ?? 0,
      imagesCount: mappedProduction?.images.length ?? 0,
      status: mappedProduction?.productionStatus,
    });

    return mappedProduction;
  } catch (error) {
    const dbError = toDatabaseErrorLike(error);

    console.error("[production-share][repository][findPublicByTokenHash] Failed", {
      tokenHashPrefix: tokenHashPrefix(tokenHash),
      code: dbError.code,
      message: dbError.message,
      detail: dbError.detail,
      hint: dbError.hint,
      schema: dbError.schema,
      table: dbError.table,
      column: dbError.column,
      constraint: dbError.constraint,
      routine: dbError.routine,
    });

    normalizeSchemaError(error);
  }
}

async function createProductionImages(
  input: CreateProductionImagesInput,
): Promise<ProductionImage[] | undefined> {
  const client = await pool.connect();

  try {
    console.info("[production-share][repository][createProductionImages] Starting", {
      productionId: input.productionId,
      createdByUserId: input.createdByUserId,
      filesCount: input.images.length,
    });

    await client.query("BEGIN");
    await ensureProductionImagesSchema(client);

    const production = await findProductionById(client, input.productionId);

    if (!production) {
      console.warn("[production-share][repository][createProductionImages] Production not found", {
        productionId: input.productionId,
      });
      await client.query("ROLLBACK");
      return undefined;
    }

    const createdImages: ProductionImage[] = [];

    for (const image of input.images) {
      const result = await client.query<ProductionImageRow>(
        `
          INSERT INTO public.production_images (
            id,
            production_id,
            file_name,
            mime_type,
            file_size,
            image_data,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING
            id,
            production_id,
            file_name,
            mime_type,
            file_size,
            created_at;
        `,
        [
          randomUUID(),
          input.productionId,
          image.fileName,
          image.mimeType,
          image.fileSize,
          image.data,
          input.createdByUserId,
        ],
      );

      if (result.rows[0]) {
        createdImages.push(mapProductionImageRow(result.rows[0]));
      }
    }

    await client.query("COMMIT");

    console.info("[production-share][repository][createProductionImages] Images created", {
      productionId: input.productionId,
      createdCount: createdImages.length,
    });

    return createdImages;
  } catch (error) {
    const dbError = toDatabaseErrorLike(error);

    console.error("[production-share][repository][createProductionImages] Failed", {
      productionId: input.productionId,
      createdByUserId: input.createdByUserId,
      filesCount: input.images.length,
      code: dbError.code,
      message: dbError.message,
      detail: dbError.detail,
      hint: dbError.hint,
      schema: dbError.schema,
      table: dbError.table,
      column: dbError.column,
      constraint: dbError.constraint,
      routine: dbError.routine,
    });

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[production-share][repository][createProductionImages] Rollback failed", {
        productionId: input.productionId,
        message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }

    normalizeImagesSchemaError(error);
  } finally {
    client.release();
  }
}

async function listProductionImages(productionId: string): Promise<ProductionImage[] | undefined> {
  const client = await pool.connect();

  try {
    await ensureProductionImagesSchema(client);

    const production = await findProductionByIdWithoutLock(client, productionId);

    if (!production) {
      return undefined;
    }

    const result = await client.query<ProductionImageRow>(
      `
        SELECT
          id,
          production_id,
          file_name,
          mime_type,
          file_size,
          created_at
        FROM public.production_images
        WHERE production_id = $1
        ORDER BY created_at ASC;
      `,
      [productionId],
    );

    return result.rows.map(mapProductionImageRow);
  } catch (error) {
    normalizeImagesSchemaError(error);
  } finally {
    client.release();
  }
}

async function findPublicProductionImageFileByTokenHash(
  tokenHash: string,
  imageId: string,
): Promise<PublicProductionImageFile | undefined> {
  const hasImagesTable = await hasProductionImagesTable();

  if (!hasImagesTable) {
    return undefined;
  }

  try {
    const result = await pool.query<ProductionImageFileRow>(
      `
        SELECT
          pi.id,
          pi.production_id,
          pi.file_name,
          pi.mime_type,
          pi.file_size,
          pi.created_at,
          pi.image_data
        FROM public.production_share_links psl
        INNER JOIN public.production_images pi
          ON pi.production_id = psl.production_id
        WHERE psl.token_hash = $1
          AND psl.revoked_at IS NULL
          AND (psl.expires_at IS NULL OR psl.expires_at > NOW())
          AND pi.id = $2
        LIMIT 1;
      `,
      [tokenHash, imageId],
    );

    const row = result.rows[0];
    return row ? mapPublicProductionImageFileRow(row) : undefined;
  } catch (error) {
    if (isSchemaError(error) && referencesProductionImagesSchema(error)) {
      console.warn("[production-share][repository][findPublicImageByTokenHash] Images schema unavailable", {
        tokenHashPrefix: tokenHashPrefix(tokenHash),
        imageId,
      });
      productionImagesTableExists = false;
      return undefined;
    }

    normalizeSchemaError(error);
  }
}

export const productionShareRepository = {
  createShareLink,
  findPublicProductionByTokenHash,
  createProductionImages,
  listProductionImages,
  findPublicProductionImageFileByTokenHash,
};
