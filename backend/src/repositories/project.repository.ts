import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import {
  ACTIVE_PROJECT_STATUS,
  CreateProjectInput,
  NewProjectCost,
  ProjectCost,
  ProjectHoursByEmployee,
  ProjectListItem,
  ProjectStatus,
  ProjectTotals,
  UpdateProjectInput,
} from "../models/project.model";
import { AppError } from "../utils/app-error";

interface ProjectRow {
  id: string;
  name: string;
  client_name: string;
  deadline: string | null;
  status: string;
  total_cost: string | number | null;
  total_paid: string | number | null;
  total_to_pay: string | number | null;
  total_minutes: string | number | null;
  last_update_note: string | null;
  last_update_at: string | Date | null;
  labor_value: string | number | null;
  discount_value: string | number | null;
  created_at: string | Date | null;
  finished_at: string | Date | null;
}

interface CostRow {
  id: string;
  production_id: string;
  description: string;
  amount: string | number;
  supplier: string | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string | Date;
  is_commission: boolean;
  commission_employee_id: string | null;
  commission_employee_name: string | null;
  commission_percent: string | number | null;
}

const COST_COLUMNS = `
  id,
  production_id,
  description,
  amount,
  supplier,
  is_paid,
  TO_CHAR(paid_at, 'YYYY-MM-DD') AS paid_at,
  created_at,
  is_commission,
  commission_employee_id,
  (SELECT e.name FROM public.employees e WHERE e.id::text = public.production_expenses.commission_employee_id) AS commission_employee_name,
  commission_percent
`;

const PROJECT_SELECT = `
  SELECT
    po.id::text AS id,
    po.description AS name,
    po.client_name,
    TO_CHAR(po.delivery_date, 'YYYY-MM-DD') AS deadline,
    po.project_status AS status,
    po.last_update_note,
    po.last_update_at,
    po.labor_value,
    po.discount_value,
    po.created_at,
    po.finished_at,
    COALESCE(c.total_cost, 0) AS total_cost,
    COALESCE(c.total_paid, 0) AS total_paid,
    COALESCE(c.total_to_pay, 0) AS total_to_pay,
    COALESCE(h.total_minutes, 0) AS total_minutes
  FROM public.production_orders po
  LEFT JOIN (
    SELECT
      production_id,
      SUM(amount) AS total_cost,
      SUM(amount) FILTER (WHERE is_paid) AS total_paid,
      SUM(amount) FILTER (WHERE NOT is_paid) AS total_to_pay
    FROM public.production_expenses
    GROUP BY production_id
  ) c ON c.production_id = po.id::text
  LEFT JOIN (
    SELECT production_id, SUM(minutes) AS total_minutes
    FROM public.work_hours
    WHERE production_id IS NOT NULL
    GROUP BY production_id
  ) h ON h.production_id = po.id::text
`;

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingSchemaError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "42P01" || code === "42703";
}

function wrapSchemaError(error: unknown): never {
  if (isMissingSchemaError(error)) {
    throw new AppError("Project schema is not configured. Run sql/20260921_project_mvp.sql", 500);
  }

  throw error;
}

function mapCost(row: CostRow): ProjectCost {
  return {
    id: row.id,
    projectId: row.production_id,
    description: row.description,
    amount: toNumber(row.amount),
    supplier: row.supplier,
    isPaid: row.is_paid,
    paidAt: row.paid_at,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    isCommission: row.is_commission,
    commissionEmployeeId: row.commission_employee_id,
    commissionEmployeeName: row.commission_employee_name,
    commissionPercent: row.commission_percent === null ? null : toNumber(row.commission_percent),
  };
}

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    deadline: row.deadline,
    status: row.status as ProjectStatus,
    lastUpdateNote: row.last_update_note,
    lastUpdateAt:
      row.last_update_at instanceof Date ? row.last_update_at.toISOString() : row.last_update_at,
    laborValue: toNumber(row.labor_value),
    discountValue: toNumber(row.discount_value),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    finishedAt: row.finished_at instanceof Date ? row.finished_at.toISOString() : row.finished_at,
    totals: {
      totalPaid: toNumber(row.total_paid),
      totalToPay: toNumber(row.total_to_pay),
      totalCost: toNumber(row.total_cost),
    },
    totalMinutes: toNumber(row.total_minutes),
  };
}

export type ProjectRecord = ReturnType<typeof mapProject>;

async function list(): Promise<ProjectRecord[]> {
  try {
    const result = await pool.query<ProjectRow>(`${PROJECT_SELECT} ORDER BY po.created_at DESC;`);
    return result.rows.map(mapProject);
  } catch (error) {
    return wrapSchemaError(error);
  }
}

/** Names only: what employees may see when choosing where they logged hours. */
async function listActiveNames(): Promise<ProjectListItem[]> {
  try {
    const result = await pool.query<{ id: string; name: string; client_name: string }>(
      `
        SELECT po.id::text AS id, po.description AS name, po.client_name
        FROM public.production_orders po
        WHERE po.project_status = $1
        ORDER BY po.client_name ASC, po.description ASC;
      `,
      [ACTIVE_PROJECT_STATUS],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      clientName: row.client_name,
      deadline: null,
      status: ACTIVE_PROJECT_STATUS,
    }));
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function findById(id: string): Promise<ProjectRecord | undefined> {
  try {
    const result = await pool.query<ProjectRow>(`${PROJECT_SELECT} WHERE po.id::text = $1;`, [id]);
    return result.rows[0] ? mapProject(result.rows[0]) : undefined;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function isActive(id: string): Promise<boolean> {
  try {
    const result = await pool.query(
      "SELECT 1 FROM public.production_orders WHERE id::text = $1 AND project_status = $2;",
      [id, ACTIVE_PROJECT_STATUS],
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function create(input: CreateProjectInput): Promise<string> {
  try {
    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO public.production_orders (
          client_name,
          description,
          production_status,
          project_status,
          installation_team,
          initial_cost
        )
        VALUES ($1, $2, 'pending', $3, NULL, 0)
        RETURNING id::text AS id;
      `,
      [input.clientName, input.name, input.status],
    );

    return result.rows[0].id;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function update(id: string, input: UpdateProjectInput): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) push("description", input.name);
  if (input.clientName !== undefined) push("client_name", input.clientName);
  if (input.deadline !== undefined) push("delivery_date", input.deadline);
  if (input.status !== undefined) {
    push("project_status", input.status);
    sets.push(input.status === "Finalizado" ? "finished_at = COALESCE(finished_at, NOW())" : "finished_at = NULL");
  }

  if (input.laborValue !== undefined) push("labor_value", input.laborValue);
  if (input.discountValue !== undefined) push("discount_value", input.discountValue);

  if (input.lastUpdateNote !== undefined) {
    push("last_update_note", input.lastUpdateNote || null);
    sets.push(input.lastUpdateNote ? "last_update_at = NOW()" : "last_update_at = NULL");
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.production_orders SET ${sets.join(", ")} WHERE id::text = $${values.length};`,
      values,
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function listCosts(projectId: string): Promise<ProjectCost[]> {
  try {
    const result = await pool.query<CostRow>(
      `
        SELECT ${COST_COLUMNS}
        FROM public.production_expenses
        WHERE production_id = $1
        ORDER BY created_at DESC;
      `,
      [projectId],
    );

    return result.rows.map(mapCost);
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function createCost(projectId: string, input: NewProjectCost): Promise<ProjectCost> {
  try {
    const result = await pool.query<CostRow>(
      `
        INSERT INTO public.production_expenses
          (id, production_id, description, amount, supplier, is_paid, paid_at,
           is_commission, commission_employee_id, commission_percent)
        VALUES ($1, $2, $3, $4, $5, $6::boolean, CASE WHEN $6::boolean THEN COALESCE($7::date, CURRENT_DATE) ELSE NULL END,
                $8::boolean, $9, $10)
        RETURNING ${COST_COLUMNS};
      `,
      [
        randomUUID(),
        projectId,
        input.description,
        input.amount,
        input.supplier,
        input.isPaid,
        input.paidAt,
        input.isCommission,
        input.commissionEmployeeId,
        input.commissionPercent,
      ],
    );

    return mapCost(result.rows[0]);
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function setCostPaid(
  projectId: string,
  costId: string,
  isPaid: boolean,
  paidAt?: string,
): Promise<ProjectCost | undefined> {
  try {
    const result = await pool.query<CostRow>(
      `
        UPDATE public.production_expenses
        SET is_paid = $3::boolean,
            paid_at = CASE WHEN $3::boolean THEN COALESCE($4::date, CURRENT_DATE) ELSE NULL END
        WHERE id = $1 AND production_id = $2
        RETURNING ${COST_COLUMNS};
      `,
      [costId, projectId, isPaid, paidAt ?? null],
    );

    return result.rows[0] ? mapCost(result.rows[0]) : undefined;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

/** Sum of the project's costs that are not commissions (base for percentage commissions). */
async function sumNonCommissionCosts(projectId: string): Promise<number> {
  try {
    const result = await pool.query<{ total: string | null }>(
      "SELECT SUM(amount) AS total FROM public.production_expenses WHERE production_id = $1 AND NOT is_commission;",
      [projectId],
    );

    return toNumber(result.rows[0]?.total);
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function removeCost(projectId: string, costId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      "DELETE FROM public.production_expenses WHERE id = $1 AND production_id = $2;",
      [costId, projectId],
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function hoursByEmployee(projectId: string): Promise<ProjectHoursByEmployee[]> {
  try {
    const result = await pool.query<{ employee_id: string; employee_name: string | null; minutes: string | number }>(
      `
        SELECT wh.employee_id, e.name AS employee_name, SUM(wh.minutes) AS minutes
        FROM public.work_hours wh
        LEFT JOIN public.employees e ON e.id::text = wh.employee_id
        WHERE wh.production_id = $1
        GROUP BY wh.employee_id, e.name
        ORDER BY SUM(wh.minutes) DESC;
      `,
      [projectId],
    );

    return result.rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name ?? "Funcionário removido",
      minutes: toNumber(row.minutes),
    }));
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function getDashboardTotals(): Promise<
  ProjectTotals & { totalProjects: number; activeProjects: number; overdueProjects: number }
> {
  try {
    const [counts, costs] = await Promise.all([
      pool.query<{ total: string; active: string; overdue: string }>(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE project_status = $1) AS active,
            COUNT(*) FILTER (WHERE project_status = $1 AND delivery_date IS NOT NULL AND delivery_date < CURRENT_DATE) AS overdue
          FROM public.production_orders;
        `,
        [ACTIVE_PROJECT_STATUS],
      ),
      pool.query<{ total_paid: string | null; total_to_pay: string | null }>(
        `
          SELECT
            SUM(amount) FILTER (WHERE is_paid) AS total_paid,
            SUM(amount) FILTER (WHERE NOT is_paid) AS total_to_pay
          FROM public.production_expenses e
          WHERE EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id::text = e.production_id);
        `,
      ),
    ]);

    const totalPaid = toNumber(costs.rows[0]?.total_paid);
    const totalToPay = toNumber(costs.rows[0]?.total_to_pay);

    return {
      totalProjects: toNumber(counts.rows[0]?.total),
      activeProjects: toNumber(counts.rows[0]?.active),
      overdueProjects: toNumber(counts.rows[0]?.overdue),
      totalPaid,
      totalToPay,
      totalCost: totalPaid + totalToPay,
    };
  } catch (error) {
    return wrapSchemaError(error);
  }
}

async function sumMinutesInRange(from: string, to: string): Promise<number> {
  try {
    const result = await pool.query<{ minutes: string | null }>(
      "SELECT SUM(minutes) AS minutes FROM public.work_hours WHERE work_date BETWEEN $1::date AND $2::date;",
      [from, to],
    );

    return toNumber(result.rows[0]?.minutes);
  } catch (error) {
    return wrapSchemaError(error);
  }
}

export interface MonthlyRawRow {
  month: string;
  expenses: number;
  commissions: number;
  profit: number;
  peakProjects: number;
}

/** Monthly series from `fromMonth` (YYYY-MM-01) to today, keyed by YYYY-MM. */
async function getMonthlySeries(fromMonth: string): Promise<Map<string, MonthlyRawRow>> {
  const rows = new Map<string, MonthlyRawRow>();
  const ensure = (month: string) => {
    let row = rows.get(month);

    if (!row) {
      row = { month, expenses: 0, commissions: 0, profit: 0, peakProjects: 0 };
      rows.set(month, row);
    }

    return row;
  };

  try {
    const [costs, profits, peaks] = await Promise.all([
      pool.query<{ month: string; expenses: string | null; commissions: string | null }>(
        `
          SELECT
            TO_CHAR(e.created_at, 'YYYY-MM') AS month,
            SUM(e.amount) FILTER (WHERE NOT e.is_commission) AS expenses,
            SUM(e.amount) FILTER (WHERE e.is_commission) AS commissions
          FROM public.production_expenses e
          WHERE e.created_at >= $1::date
            AND EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id::text = e.production_id)
          GROUP BY 1;
        `,
        [fromMonth],
      ),
      // Final value (items + labor - discount) minus costs (items + commissions) = labor - discount - commissions.
      pool.query<{ month: string; profit: string | null }>(
        `
          SELECT
            TO_CHAR(po.finished_at, 'YYYY-MM') AS month,
            SUM(po.labor_value - po.discount_value - COALESCE(c.commissions, 0)) AS profit
          FROM public.production_orders po
          LEFT JOIN (
            SELECT production_id, SUM(amount) AS commissions
            FROM public.production_expenses
            WHERE is_commission
            GROUP BY production_id
          ) c ON c.production_id = po.id::text
          WHERE po.project_status = $2 AND po.finished_at >= $1::date
          GROUP BY 1;
        `,
        [fromMonth, "Finalizado"],
      ),
      pool.query<{ month: string; peak: string | null }>(
        `
          SELECT TO_CHAR(t.d, 'YYYY-MM') AS month, MAX(t.cnt) AS peak
          FROM (
            SELECT d::date AS d, COUNT(po.id) AS cnt
            FROM generate_series($1::date, CURRENT_DATE, INTERVAL '1 day') AS d
            LEFT JOIN public.production_orders po
              ON po.created_at::date <= d::date
             AND COALESCE(po.finished_at::date, CURRENT_DATE) >= d::date
            GROUP BY d
          ) t
          GROUP BY 1;
        `,
        [fromMonth],
      ),
    ]);

    for (const row of costs.rows) {
      const point = ensure(row.month);
      point.expenses = toNumber(row.expenses);
      point.commissions = toNumber(row.commissions);
    }

    for (const row of profits.rows) {
      ensure(row.month).profit = toNumber(row.profit);
    }

    for (const row of peaks.rows) {
      ensure(row.month).peakProjects = toNumber(row.peak);
    }

    return rows;
  } catch (error) {
    return wrapSchemaError(error);
  }
}

export const projectRepository = {
  getMonthlySeries,
  list,
  listActiveNames,
  findById,
  isActive,
  create,
  update,
  listCosts,
  createCost,
  setCostPaid,
  removeCost,
  sumNonCommissionCosts,
  hoursByEmployee,
  getDashboardTotals,
  sumMinutesInRange,
};
