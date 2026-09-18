import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { WorkHoursEntry } from "../models/work-hours.model";
import { AppError } from "../utils/app-error";

interface WorkHoursRow {
  id: string;
  employee_id: string;
  production_id: string;
  work_date: string;
  minutes: number;
  production_label: string | null;
}

const SELECT_ENTRIES = `
  SELECT
    wh.id,
    wh.employee_id,
    wh.production_id,
    TO_CHAR(wh.work_date, 'YYYY-MM-DD') AS work_date,
    wh.minutes,
    NULLIF(CONCAT_WS(' - ', po.client_name, po.description), '') AS production_label
  FROM public.work_hours wh
  LEFT JOIN public.production_orders po
    ON po.id::text = wh.production_id
`;

function mapRow(row: WorkHoursRow): WorkHoursEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    productionId: row.production_id,
    productionLabel: row.production_label,
    workDate: row.work_date,
    minutes: Number(row.minutes),
  };
}

function isMissingTableError(error: unknown): boolean {
  return (error as { code?: string }).code === "42P01";
}

function wrapMissingTable(error: unknown): never {
  if (isMissingTableError(error)) {
    throw new AppError("Work hours schema is not configured. Run sql/20260918_create_work_hours.sql", 500);
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
        ORDER BY wh.work_date DESC, production_label ASC NULLS LAST;
      `,
      [employeeId, from, to],
    );

    return result.rows.map(mapRow);
  } catch (error) {
    return wrapMissingTable(error);
  }
}

async function upsert(employeeId: string, productionId: string, workDate: string, minutes: number): Promise<void> {
  try {
    await pool.query(
      `
        INSERT INTO public.work_hours (id, employee_id, production_id, work_date, minutes)
        VALUES ($1, $2, $3, $4::date, $5)
        ON CONFLICT (employee_id, production_id, work_date)
        DO UPDATE SET minutes = EXCLUDED.minutes, updated_at = NOW();
      `,
      [randomUUID(), employeeId, productionId, workDate, minutes],
    );
  } catch (error) {
    wrapMissingTable(error);
  }
}

async function remove(employeeId: string, productionId: string, workDate: string): Promise<void> {
  try {
    await pool.query(
      `
        DELETE FROM public.work_hours
        WHERE employee_id = $1 AND production_id = $2 AND work_date = $3::date;
      `,
      [employeeId, productionId, workDate],
    );
  } catch (error) {
    wrapMissingTable(error);
  }
}

export const workHoursRepository = {
  listByEmployeeAndRange,
  upsert,
  remove,
};
