import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import {
  ActiveProductionMaterialConsumptionItem,
  ActiveProductionMaterialConsumptionResponse,
  CreateFechamentoInput,
  Fechamento,
  ListFechamentosQueryInput,
  LogisticsDateFilterQueryInput,
  LogisticsSummary,
  LogisticsSummaryTopMaterial,
} from "../models/logistics.model";
import { AppError } from "../utils/app-error";

const ACTIVE_PRODUCTION_STATUSES = [
  "pending",
  "cutting",
  "assembly",
  "finishing",
  // Controle de qualidade permanece no grupo de producoes ativas.
  "quality_check",
] as const;

interface LogisticsSummaryRow {
  teams_count: string | number;
  active_employees_count: string | number;
  active_count: string | number;
  overdue_count: string | number;
  near_deadline_count: string | number;
  on_time_count: string | number;
  active_productions_total_cost: string | number | null;
}

interface TopMaterialRow {
  product_id: string | null;
  product_name: string | null;
  unit: string | null;
  total_quantity: string | number | null;
}

interface ActiveMaterialConsumptionRow {
  product_id: string;
  product_name: string;
  unit: string | null;
  total_quantity_used: string | number;
  active_productions_count: string | number;
}

interface FechamentoRow {
  id: string;
  reference_month: string | Date;
  custo_geral_ativo: string | number;
  receita_vinculada: string | number;
  lucro_liquido: string | number;
  lucro_bruto: string | number;
  custos_aplicados_pre_aprovados: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

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

function toReferenceMonth(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function mapTopMaterialRow(row: TopMaterialRow): LogisticsSummaryTopMaterial {
  return {
    productId: row.product_id ?? "",
    productName: row.product_name ?? "",
    unit: row.unit ?? "",
    totalQuantity: toNumber(row.total_quantity),
  };
}

function mapActiveMaterialConsumptionRow(
  row: ActiveMaterialConsumptionRow,
): ActiveProductionMaterialConsumptionItem {
  return {
    productId: row.product_id,
    productName: row.product_name,
    unit: row.unit ?? "",
    totalQuantityUsed: toNumber(row.total_quantity_used),
    activeProductionsCount: toNumber(row.active_productions_count),
  };
}

function mapFechamentoRow(row: FechamentoRow): Fechamento {
  return {
    id: row.id,
    referenceMonth: toReferenceMonth(row.reference_month),
    custoGeralAtivo: toNumber(row.custo_geral_ativo),
    receitaVinculada: toNumber(row.receita_vinculada),
    lucroLiquido: toNumber(row.lucro_liquido),
    lucroBruto: toNumber(row.lucro_bruto),
    custosAplicadosPreAprovados: toNumber(row.custos_aplicados_pre_aprovados),
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function toUtcRangeBoundary(value: string | undefined, mode: "start" | "end"): string | null {
  if (!value) {
    return null;
  }

  if (mode === "start") {
    return `${value}T00:00:00.000Z`;
  }

  return `${value}T23:59:59.999Z`;
}

async function getSummary(): Promise<LogisticsSummary> {
  const summaryResult = await pool.query<LogisticsSummaryRow>(
    `
      WITH active_productions AS (
        SELECT
          po.id,
          po.delivery_date::date AS delivery_date,
          po.initial_cost
        FROM public.production_orders po
        WHERE po.production_status = ANY($1::text[])
      )
      SELECT
        (SELECT COUNT(*) FROM public.teams) AS teams_count,
        (SELECT COUNT(*) FROM public.employees e WHERE e.is_active = TRUE) AS active_employees_count,
        (SELECT COUNT(*) FROM active_productions) AS active_count,
        (
          SELECT COUNT(*)
          FROM active_productions ap
          WHERE ap.delivery_date IS NOT NULL
            AND ap.delivery_date < CURRENT_DATE
        ) AS overdue_count,
        (
          SELECT COUNT(*)
          FROM active_productions ap
          WHERE ap.delivery_date IS NOT NULL
            AND ap.delivery_date >= CURRENT_DATE
            AND ap.delivery_date <= CURRENT_DATE + 3
        ) AS near_deadline_count,
        (
          SELECT COUNT(*)
          FROM active_productions ap
          WHERE ap.delivery_date IS NOT NULL
            AND ap.delivery_date > CURRENT_DATE + 3
        ) AS on_time_count,
        (
          SELECT COALESCE(SUM(ap.initial_cost), 0)
          FROM active_productions ap
        ) AS active_productions_total_cost;
    `,
    [ACTIVE_PRODUCTION_STATUSES],
  );

  const topMaterialsResult = await pool.query<TopMaterialRow>(
    `
      SELECT
        COALESCE(pom.product_id, '') AS product_id,
        pom.product_name,
        pom.unit,
        COALESCE(SUM(pom.quantity), 0) AS total_quantity
      FROM public.production_order_materials pom
      INNER JOIN public.production_orders po
        ON po.id = pom.production_order_id
      WHERE po.production_status = ANY($1::text[])
      GROUP BY COALESCE(pom.product_id, ''), pom.product_name, pom.unit
      ORDER BY SUM(pom.quantity) DESC, pom.product_name ASC
      LIMIT 10;
    `,
    [ACTIVE_PRODUCTION_STATUSES],
  );

  const summaryRow = summaryResult.rows[0];

  return {
    teamsCount: toNumber(summaryRow.teams_count),
    activeEmployeesCount: toNumber(summaryRow.active_employees_count),
    productions: {
      activeCount: toNumber(summaryRow.active_count),
      overdueCount: toNumber(summaryRow.overdue_count),
      nearDeadlineCount: toNumber(summaryRow.near_deadline_count),
      onTimeCount: toNumber(summaryRow.on_time_count),
    },
    topMaterials: topMaterialsResult.rows.map(mapTopMaterialRow),
    activeProductionsTotalCost: toNumber(summaryRow.active_productions_total_cost),
  };
}

async function getActiveProductionsMaterialConsumption(
  query: LogisticsDateFilterQueryInput,
): Promise<ActiveProductionMaterialConsumptionResponse> {
  const whereClauses: string[] = [
    "psm.movement_type = 'saida'",
    "psm.reference_id IS NOT NULL",
    "(psm.reference_type = 'production' OR psm.reference_type = 'production_order')",
    activeProductionPredicateSql("po.production_status"),
  ];
  const params: string[] = [];

  if (query.startDate) {
    params.push(query.startDate);
    whereClauses.push(`psm.created_at >= $${params.length}::date`);
  }

  if (query.endDate) {
    params.push(query.endDate);
    whereClauses.push(`psm.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const result = await pool.query<ActiveMaterialConsumptionRow>(
    `
      SELECT
        psm.product_id,
        COALESCE(NULLIF(BTRIM(p.name), ''), psm.product_id) AS product_name,
        COALESCE(NULLIF(BTRIM(MAX(psm.unit)), ''), '') AS unit,
        COALESCE(SUM(psm.quantity), 0) AS total_quantity_used,
        COUNT(DISTINCT psm.reference_id) AS active_productions_count
      FROM public.product_stock_movements psm
      INNER JOIN public.production_orders po
        ON po.id::text = psm.reference_id
      LEFT JOIN public.products p
        ON p.id::text = psm.product_id
      ${whereSql}
      GROUP BY psm.product_id, COALESCE(NULLIF(BTRIM(p.name), ''), psm.product_id)
      ORDER BY total_quantity_used DESC, product_name ASC;
    `,
    params,
  );

  return {
    data: result.rows.map(mapActiveMaterialConsumptionRow),
    meta: {
      startDate: toUtcRangeBoundary(query.startDate, "start"),
      endDate: toUtcRangeBoundary(query.endDate, "end"),
      totalItems: result.rows.length,
    },
  };
}

async function listFechamentos(query: ListFechamentosQueryInput): Promise<Fechamento[]> {
  try {
    const params: string[] = [];
    const whereClauses: string[] = [];

    if (query.referenceMonth) {
      params.push(`${query.referenceMonth}-01`);
      whereClauses.push(`f.reference_month = $${params.length}::date`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await pool.query<FechamentoRow>(
      `
        SELECT
          f.id,
          f.reference_month,
          f.custo_geral_ativo,
          f.receita_vinculada,
          f.lucro_liquido,
          f.lucro_bruto,
          f.custos_aplicados_pre_aprovados,
          f.created_at,
          f.updated_at
        FROM public.fechamento f
        ${whereSql}
        ORDER BY f.reference_month DESC, f.updated_at DESC;
      `,
      params,
    );

    return result.rows.map(mapFechamentoRow);
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "42P01" || code === "42703") {
      throw new AppError("Fechamento schema is not configured. Run sql/20260407_create_fechamento.sql", 500);
    }

    throw error;
  }
}

async function upsertFechamento(payload: CreateFechamentoInput): Promise<Fechamento> {
  try {
    const referenceMonthDate = `${payload.referenceMonth}-01`;

    const result = await pool.query<FechamentoRow>(
      `
        INSERT INTO public.fechamento (
          id,
          reference_month,
          custo_geral_ativo,
          receita_vinculada,
          lucro_liquido,
          lucro_bruto,
          custos_aplicados_pre_aprovados
        )
        VALUES ($1, $2::date, $3, $4, $5, $6, $7)
        ON CONFLICT (reference_month)
        DO UPDATE SET
          custo_geral_ativo = EXCLUDED.custo_geral_ativo,
          receita_vinculada = EXCLUDED.receita_vinculada,
          lucro_liquido = EXCLUDED.lucro_liquido,
          lucro_bruto = EXCLUDED.lucro_bruto,
          custos_aplicados_pre_aprovados = EXCLUDED.custos_aplicados_pre_aprovados,
          updated_at = NOW()
        RETURNING
          id,
          reference_month,
          custo_geral_ativo,
          receita_vinculada,
          lucro_liquido,
          lucro_bruto,
          custos_aplicados_pre_aprovados,
          created_at,
          updated_at;
      `,
      [
        randomUUID(),
        referenceMonthDate,
        payload.custoGeralAtivo,
        payload.receitaVinculada,
        payload.lucroLiquido,
        payload.lucroBruto,
        payload.custosAplicadosPreAprovados,
      ],
    );

    return mapFechamentoRow(result.rows[0]);
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "42P01" || code === "42703") {
      throw new AppError("Fechamento schema is not configured. Run sql/20260407_create_fechamento.sql", 500);
    }

    throw error;
  }
}

export const logisticsRepository = {
  getSummary,
  getActiveProductionsMaterialConsumption,
  listFechamentos,
  upsertFechamento,
};
