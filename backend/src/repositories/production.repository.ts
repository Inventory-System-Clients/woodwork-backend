import { PoolClient } from "pg";
import { pool } from "../database/postgres";
import { CreateProductionInput, Production, ProductionMaterial } from "../models/production.model";

interface ProductionOrderRow {
  id: string;
  client_name: string;
  description: string;
  production_status: string;
  delivery_date: string | Date | null;
  installation_team: string | null;
  initial_cost: string | number;
}

interface ProductionWithMaterialRow extends ProductionOrderRow {
  product_id: string | null;
  product_name: string | null;
  quantity: string | number | null;
  unit: string | null;
}

let productIdColumnExists: boolean | null = null;

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

async function listById(id: string): Promise<Production | undefined> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";

    const result = await client.query<ProductionWithMaterialRow>(
      `
        SELECT
          po.id::text AS id,
          po.client_name,
          po.description,
          po.production_status,
          po.delivery_date,
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

async function findAll(): Promise<Production[]> {
  const client = await pool.connect();

  try {
    const canUseProductId = await hasProductIdColumn(client);
    const productIdSelect = canUseProductId ? "pom.product_id" : "NULL::text AS product_id";

    const result = await client.query<ProductionWithMaterialRow>(
      `
        SELECT
          po.id::text AS id,
          po.client_name,
          po.description,
          po.production_status,
          po.delivery_date,
          po.installation_team,
          po.initial_cost,
          ${productIdSelect},
          pom.product_name,
          pom.quantity,
          pom.unit
        FROM public.production_orders po
        LEFT JOIN public.production_order_materials pom
          ON pom.production_order_id = po.id
        ORDER BY po.created_at DESC, pom.id ASC;
      `,
    );

    return groupRows(result.rows);
  } finally {
    client.release();
  }
}

async function create(payload: CreateProductionInput): Promise<Production> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const canUseProductId = await hasProductIdColumn(client);

    const productionInsert = await client.query<ProductionOrderRow>(
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
          installation_team,
          initial_cost;
      `,
      [
        payload.clientName,
        payload.description,
        payload.deliveryDate ?? null,
        payload.installationTeam ?? null,
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
  const updateResult = await pool.query<ProductionOrderRow>(
    `
      UPDATE public.production_orders
      SET
        production_status = 'delivered',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id::text AS id,
        client_name,
        description,
        production_status,
        delivery_date,
        installation_team,
        initial_cost;
    `,
    [id],
  );

  if (updateResult.rows.length === 0) {
    return undefined;
  }

  const fullProduction = await listById(id);

  if (fullProduction) {
    return fullProduction;
  }

  return mapProductionRow(updateResult.rows[0]);
}

export const productionRepository = {
  findAll,
  create,
  complete,
};
