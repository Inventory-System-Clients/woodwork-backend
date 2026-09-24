import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { WorkHoursEntry, WorkHoursSummaryRow } from "../models/work-hours.model";
import { AppError } from "../utils/app-error";

interface WorkHoursRow {
  id: string;
  employee_id: string;
  production_id: string | null;
  activity: string | null;
  work_date: string;
  minutes: number;
  production_label: string | null;
}

const SELECT_ENTRIES = `
  SELECT
    wh.id,
    wh.employee_id,
    wh.production_id,
    wh.activity,
    TO_CHAR(wh.work_date, 'YYYY-MM-DD') AS work_date,
    wh.minutes,
    NULLIF(CONCAT_WS(' - ', po.client_name, po.description), '') AS production_label
  FROM public.work_hours wh
  LEFT JOIN public.production_orders po
    ON po.id::text = wh.production_id
`;

export interface ReplaceDayEntry {
  productionId: string | null;
  activity: string | null;
  minutes: number;
}

function mapRow(row: WorkHoursRow): WorkHoursEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    productionId: row.production_id,
    productionLabel: row.production_label,
    activity: row.activity,
    workDate: row.work_date,
    minutes: Number(row.minutes),
  };
}

function wrapMissingSchema(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703" || code === "23502") {
    throw new AppError("Work hours schema is not configured. Run sql/20260921_project_mvp.sql", 500);
  }

  throw error;
}

async function listByEmployeeAndRange(employeeId: string, from: string, to: string): Promise<WorkHoursEntry[]> {
  try {
    const result = await pool.query<WorkHoursRow>(
      `
        ${SELECT_ENTRIES}
        WHERE wh.employee_id = $1
          AND wh.work_date BETWEEN $2::date AND $3::date
        ORDER BY wh.work_date DESC, production_label ASC NULLS LAST, wh.activity ASC NULLS LAST;
      `,
      [employeeId, from, to],
    );

    return result.rows.map(mapRow);
  } catch (error) {
    return wrapMissingSchema(error);
  }
}

async function findById(id: string): Promise<WorkHoursEntry | null> {
  try {
    const result = await pool.query<WorkHoursRow>(`${SELECT_ENTRIES} WHERE wh.id::text = $1;`, [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    return wrapMissingSchema(error);
  }
}

async function updateMinutes(id: string, minutes: number): Promise<void> {
  try {
    await pool.query("UPDATE public.work_hours SET minutes = $2 WHERE id::text = $1;", [id, minutes]);
  } catch (error) {
    wrapMissingSchema(error);
  }
}

async function deleteById(id: string): Promise<boolean> {
  try {
    const result = await pool.query("DELETE FROM public.work_hours WHERE id::text = $1;", [id]);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return wrapMissingSchema(error);
  }
}

/** Replaces all of the employee's lines for one day in a single transaction. */
async function replaceDay(employeeId: string, workDate: string, entries: ReplaceDayEntry[]): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM public.work_hours WHERE employee_id = $1 AND work_date = $2::date;", [
      employeeId,
      workDate,
    ]);

    for (const entry of entries) {
      await client.query(
        `
          INSERT INTO public.work_hours (id, employee_id, production_id, activity, work_date, minutes)
          VALUES ($1, $2, $3, $4, $5::date, $6);
        `,
        [randomUUID(), employeeId, entry.productionId, entry.activity, workDate, entry.minutes],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    wrapMissingSchema(error);
  } finally {
    client.release();
  }
}

async function summarize(from: string, to: string): Promise<WorkHoursSummaryRow[]> {
  try {
    const result = await pool.query<{
      employee_id: string;
      employee_name: string | null;
      production_id: string | null;
      activity: string | null;
      production_label: string | null;
      minutes: string | number;
    }>(
      `
        SELECT
          wh.employee_id,
          e.name AS employee_name,
          wh.production_id,
          MIN(wh.activity) AS activity,
          MIN(NULLIF(CONCAT_WS(' - ', po.client_name, po.description), '')) AS production_label,
          SUM(wh.minutes) AS minutes
        FROM public.work_hours wh
        LEFT JOIN public.employees e ON e.id::text = wh.employee_id
        LEFT JOIN public.production_orders po ON po.id::text = wh.production_id
        WHERE wh.work_date BETWEEN $1::date AND $2::date
        GROUP BY wh.employee_id, e.name, wh.production_id, CASE WHEN wh.production_id IS NULL THEN LOWER(wh.activity) END
        ORDER BY e.name ASC NULLS LAST, SUM(wh.minutes) DESC;
      `,
      [from, to],
    );

    return result.rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name ?? "Funcionário removido",
      projectId: row.production_id,
      label: row.production_id
        ? (row.production_label ?? "Projeto removido")
        : (row.activity ?? "Outra atividade"),
      isActivity: row.production_id === null,
      minutes: Number(row.minutes),
    }));
  } catch (error) {
    return wrapMissingSchema(error);
  }
}

export const workHoursRepository = {
  listByEmployeeAndRange,
  findById,
  updateMinutes,
  deleteById,
  replaceDay,
  summarize,
};
