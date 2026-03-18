import { pool } from "../database/postgres";
import { LogisticsSummary, LogisticsSummaryTopMaterial } from "../models/logistics.model";

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

function toNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapTopMaterialRow(row: TopMaterialRow): LogisticsSummaryTopMaterial {
  return {
    productId: row.product_id ?? "",
    productName: row.product_name ?? "",
    unit: row.unit ?? "",
    totalQuantity: toNumber(row.total_quantity),
  };
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

export const logisticsRepository = {
  getSummary,
};
