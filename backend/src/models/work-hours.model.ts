import { z } from "zod";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use the YYYY-MM-DD format");

export const workHoursDateSchema = dateOnlySchema;

export const OTHER_ACTIVITY_SUGGESTIONS = [
  "Limpeza",
  "Organização",
  "Manutenção",
  "Reunião",
  "Transporte",
  "Recebimento de materiais",
  "Administrativo",
  "Outro",
] as const;

const minutesSchema = z.coerce
  .number()
  .int("minutes must be an integer")
  .min(0, "minutes cannot be negative")
  .max(1440, "minutes cannot exceed 24 hours");

// Each line is either a project (projectId) or another activity (free text), never both.
export const workHoursEntryInputSchema = z
  .object({
    projectId: z.string().trim().min(1).optional().nullable(),
    activity: z.string().trim().min(1).max(160).optional().nullable(),
    minutes: minutesSchema,
  })
  .refine((entry) => Boolean(entry.projectId) !== Boolean(entry.activity), {
    message: "Each entry needs either projectId or activity",
  });

// Replaces everything the employee logged for the day.
export const setDayWorkHoursSchema = z.object({
  date: dateOnlySchema.optional(),
  entries: z.array(workHoursEntryInputSchema).max(50, "too many entries"),
});

// Admin correction of a single logged line (use DELETE to remove it).
export const updateWorkHoursEntrySchema = z.object({
  minutes: minutesSchema.refine((value) => value > 0, "minutes must be greater than zero"),
});

export const listWorkHoursQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export interface WorkHoursEntry {
  id: string;
  employeeId: string;
  productionId: string | null;
  productionLabel: string | null;
  activity: string | null;
  workDate: string;
  minutes: number;
}

export interface DayWorkHours {
  date: string;
  today: string;
  yesterday: string;
  totalMinutes: number;
  entries: WorkHoursEntry[];
}

export interface EmployeeWorkHoursReport {
  employeeId: string;
  from: string;
  to: string;
  totalMinutes: number;
  entries: WorkHoursEntry[];
}

export type SetDayWorkHoursInput = z.infer<typeof setDayWorkHoursSchema>;
export type UpdateWorkHoursEntryInput = z.infer<typeof updateWorkHoursEntrySchema>;
export type ListWorkHoursQueryInput = z.infer<typeof listWorkHoursQuerySchema>;


export interface WorkHoursSummaryRow {
  employeeId: string;
  employeeName: string;
  projectId: string | null;
  label: string;
  isActivity: boolean;
  minutes: number;
}

export interface WorkHoursSummary {
  from: string;
  to: string;
  totalMinutes: number;
  rows: WorkHoursSummaryRow[];
}

export type WorkHoursEntryInput = z.infer<typeof workHoursEntryInputSchema>;
