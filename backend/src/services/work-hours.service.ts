import {
  DayWorkHours,
  EmployeeWorkHoursReport,
  ListWorkHoursQueryInput,
  SetDayWorkHoursInput,
  UpdateWorkHoursEntryInput,
  WorkHoursEntry,
  WorkHoursSummary,
} from "../models/work-hours.model";
import { employeeRepository } from "../repositories/employee.repository";
import { projectRepository } from "../repositories/project.repository";
import { ReplaceDayEntry, workHoursRepository } from "../repositories/work-hours.repository";
import { AppError } from "../utils/app-error";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
// Total across every project and activity logged by the employee on the same day.
const MAX_MINUTES_PER_DAY = 8 * 60;
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

  // Merge repeated lines (same project or same activity) and drop empty ones.
  const merged = new Map<string, ReplaceDayEntry>();

  for (const entry of payload.entries) {
    if (entry.minutes <= 0) {
      continue;
    }

    const activity = entry.projectId ? null : (entry.activity ?? "").trim();
    const key = entry.projectId ? `p:${entry.projectId}` : `a:${activity?.toLowerCase()}`;
    const existing = merged.get(key);

    if (existing) {
      existing.minutes += entry.minutes;
    } else {
      merged.set(key, { productionId: entry.projectId ?? null, activity, minutes: entry.minutes });
    }
  }

  const entries = [...merged.values()];
  const totalMinutes = sumMinutes(entries);

  if (totalMinutes > MAX_MINUTES_PER_DAY) {
    throw new AppError("Total hours in a day cannot exceed 8 hours", 400, { totalMinutes });
  }

  // Only projects still in progress accept new hours, but lines kept as-is on a finished project stay valid.
  const previous = await workHoursRepository.listByEmployeeAndRange(employeeId, date, date);
  const previousProjectIds = new Set(previous.map((entry) => entry.productionId).filter(Boolean));

  for (const entry of entries) {
    if (!entry.productionId || previousProjectIds.has(entry.productionId)) {
      continue;
    }

    if (!(await projectRepository.isActive(entry.productionId))) {
      throw new AppError("Project is not in progress", 400, { projectId: entry.productionId });
    }
  }

  await workHoursRepository.replaceDay(employeeId, date, entries);
  return getDay(employeeId, date);
}

/** Admin correction: changes one line's minutes, still respecting the daily limit. */
async function updateEntry(id: string, payload: UpdateWorkHoursEntryInput): Promise<WorkHoursEntry> {
  const entry = await workHoursRepository.findById(id);

  if (!entry) {
    throw new AppError("Work hours entry not found", 404);
  }

  const dayEntries = await workHoursRepository.listByEmployeeAndRange(entry.employeeId, entry.workDate, entry.workDate);
  const totalMinutes = sumMinutes(dayEntries.filter((item) => item.id !== id)) + payload.minutes;

  if (totalMinutes > MAX_MINUTES_PER_DAY) {
    throw new AppError("Total hours in a day cannot exceed 8 hours", 400, { totalMinutes });
  }

  await workHoursRepository.updateMinutes(id, payload.minutes);
  return { ...entry, minutes: payload.minutes };
}

async function deleteEntry(id: string): Promise<void> {
  if (!(await workHoursRepository.deleteById(id))) {
    throw new AppError("Work hours entry not found", 404);
  }
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

function currentMonthStart(today: string): string {
  return `${today.slice(0, 8)}01`;
}

async function getSummary(query: ListWorkHoursQueryInput): Promise<WorkHoursSummary> {
  const today = formatDateInBusinessZone(new Date());
  const to = query.to ?? today;
  const from = query.from ?? currentMonthStart(to);

  if (from > to) {
    throw new AppError("from must be earlier than or equal to to", 400);
  }

  if (shiftDate(from, MAX_REPORT_DAYS) < to) {
    throw new AppError(`The period cannot exceed ${MAX_REPORT_DAYS} days`, 400);
  }

  const rows = await workHoursRepository.summarize(from, to);
  return { from, to, totalMinutes: sumMinutes(rows), rows };
}

export const workHoursService = {
  getSummary,
  formatDateInBusinessZone,
  getDay,
  setDay,
  updateEntry,
  deleteEntry,
  getReportForEmployee,
};
