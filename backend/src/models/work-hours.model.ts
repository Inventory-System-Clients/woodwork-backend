import { z } from "zod";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use the YYYY-MM-DD format");

export const workHoursDateSchema = dateOnlySchema;

export const setDayWorkHoursSchema = z.object({
  productionId: z.string().trim().min(1, "productionId is required"),
  date: dateOnlySchema.optional(),
  minutes: z.coerce
    .number()
    .int("minutes must be an integer")
    .min(0, "minutes cannot be negative")
    .max(1440, "minutes cannot exceed 24 hours"),
});

export const listWorkHoursQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export interface WorkHoursEntry {
  id: string;
  employeeId: string;
  productionId: string;
  productionLabel: string | null;
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
export type ListWorkHoursQueryInput = z.infer<typeof listWorkHoursQuerySchema>;
