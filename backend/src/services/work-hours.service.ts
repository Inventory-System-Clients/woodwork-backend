import {
  DayWorkHours,
  EmployeeWorkHoursReport,
  ListWorkHoursQueryInput,
  SetDayWorkHoursInput,
} from "../models/work-hours.model";
import { employeeRepository } from "../repositories/employee.repository";
import { productionRepository } from "../repositories/production.repository";
import { workHoursRepository } from "../repositories/work-hours.repository";
import { AppError } from "../utils/app-error";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const MAX_MINUTES_PER_DAY = 24 * 60;
const DEFAULT_REPORT_DAYS = 7;
const MAX_REPORT_DAYS = 366;

function formatDateInBusinessZone(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDate(dateOnly: string, days: number): string {
  const shifted = new Date(`${dateOnly}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function sumMinutes(entries: { minutes: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

function resolveAllowedDate(requestedDate?: string): { date: string; today: string; yesterday: string } {
  const today = formatDateInBusinessZone(new Date());
  const yesterday = shiftDate(today, -1);
  const date = requestedDate ?? today;

  if (date !== today && date !== yesterday) {
    throw new AppError("Hours can only be logged for today or yesterday", 400, { today, yesterday });
  }

  return { date, today, yesterday };
}

async function getDay(employeeId: string, requestedDate?: string): Promise<DayWorkHours> {
  const { date, today, yesterday } = resolveAllowedDate(requestedDate);
  const entries = await workHoursRepository.listByEmployeeAndRange(employeeId, date, date);

  return { date, today, yesterday, totalMinutes: sumMinutes(entries), entries };
}

async function setDay(employeeId: string, payload: SetDayWorkHoursInput): Promise<DayWorkHours> {
  const { date } = resolveAllowedDate(payload.date);

  if (payload.minutes === 0) {
    await workHoursRepository.remove(employeeId, payload.productionId, date);
    return getDay(employeeId, date);
  }

  const productions = await productionRepository.findAll({ employeeId, activeOnly: true });

  if (!productions.some((production) => production.id === payload.productionId)) {
    throw new AppError("Production is not in progress or is not assigned to your teams", 403, {
      productionId: payload.productionId,
    });
  }

  const day = await getDay(employeeId, date);
  const otherMinutes = sumMinutes(day.entries.filter((entry) => entry.productionId !== payload.productionId));

  if (otherMinutes + payload.minutes > MAX_MINUTES_PER_DAY) {
    throw new AppError("Total hours in a day cannot exceed 24 hours", 400, {
      alreadyLoggedMinutes: otherMinutes,
    });
  }

  await workHoursRepository.upsert(employeeId, payload.productionId, date, payload.minutes);
  return getDay(employeeId, date);
}

async function getReportForEmployee(
  employeeId: string,
  query: ListWorkHoursQueryInput,
): Promise<EmployeeWorkHoursReport> {
  const employee = await employeeRepository.findById(employeeId);

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  const to = query.to ?? formatDateInBusinessZone(new Date());
  const from = query.from ?? shiftDate(to, -(DEFAULT_REPORT_DAYS - 1));

  if (from > to) {
    throw new AppError("from must be earlier than or equal to to", 400);
  }

  if (shiftDate(from, MAX_REPORT_DAYS) < to) {
    throw new AppError(`The period cannot exceed ${MAX_REPORT_DAYS} days`, 400);
  }

  const entries = await workHoursRepository.listByEmployeeAndRange(employeeId, from, to);

  return { employeeId, from, to, totalMinutes: sumMinutes(entries), entries };
}

export const workHoursService = {
  getDay,
  setDay,
  getReportForEmployee,
};
