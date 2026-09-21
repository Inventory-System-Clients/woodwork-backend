import { z } from "zod";

export const PROJECT_STATUSES = ["Em andamento", "Pausado", "Finalizado"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const ACTIVE_PROJECT_STATUS: ProjectStatus = "Em andamento";

const projectStatusSchema = z.enum(PROJECT_STATUSES);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use the YYYY-MM-DD format");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(2000),
  clientName: z.string().trim().min(1, "clientName is required").max(200),
  status: projectStatusSchema.default(ACTIVE_PROJECT_STATUS),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(2000).optional(),
    clientName: z.string().trim().min(1).max(200).optional(),
    deadline: dateOnlySchema.nullable().optional(),
    status: projectStatusSchema.optional(),
    lastUpdateNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const createProjectCostSchema = z
  .object({
    description: z.string().trim().max(255).optional(),
    amount: z.coerce.number().nonnegative("amount cannot be negative").optional(),
    supplier: z.string().trim().max(160).optional().nullable(),
    isPaid: z.coerce.boolean().default(false),
    paidAt: dateOnlySchema.optional().nullable(),
    // Commission: paid to an employee, as a percentage of the project's other costs or as a fixed value.
    isCommission: z.coerce.boolean().default(false),
    commissionMode: z.enum(["percent", "value"]).optional(),
    commissionPercent: z.coerce.number().gt(0, "commissionPercent must be greater than zero").max(100).optional(),
    commissionEmployeeId: z.string().trim().min(1).optional(),
  })
  .superRefine((cost, ctx) => {
    if (!cost.isCommission) {
      if (!cost.description) {
        ctx.addIssue({ code: "custom", path: ["description"], message: "description is required" });
      }

      if (cost.amount === undefined) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "amount is required" });
      }

      return;
    }

    if (!cost.commissionEmployeeId) {
      ctx.addIssue({ code: "custom", path: ["commissionEmployeeId"], message: "commissionEmployeeId is required" });
    }

    if (cost.commissionMode === "percent") {
      if (cost.commissionPercent === undefined) {
        ctx.addIssue({ code: "custom", path: ["commissionPercent"], message: "commissionPercent is required" });
      }
    } else if (!cost.amount || cost.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "amount must be greater than zero" });
    }
  });

export const payProjectCostSchema = z.object({
  paidAt: dateOnlySchema.optional(),
});

export interface ProjectTotals {
  totalPaid: number;
  totalToPay: number;
  totalCost: number;
}

export interface ProjectCost {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  supplier: string | null;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
  isCommission: boolean;
  commissionEmployeeId: string | null;
  commissionEmployeeName: string | null;
  commissionPercent: number | null;
}

/** Cost ready to be stored: commission amounts already resolved. */
export interface NewProjectCost {
  description: string;
  amount: number;
  supplier: string | null;
  isPaid: boolean;
  paidAt: string | null;
  isCommission: boolean;
  commissionEmployeeId: string | null;
  commissionPercent: number | null;
}

export interface ProjectHoursByEmployee {
  employeeId: string;
  employeeName: string;
  minutes: number;
}

/** List row. Financial fields are omitted for employees. */
export interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  deadline: string | null;
  status: ProjectStatus;
  totalCost?: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  clientName: string;
  deadline: string | null;
  status: ProjectStatus;
  lastUpdateNote: string | null;
  lastUpdateAt: string | null;
  totals: ProjectTotals;
  totalMinutes: number;
  hoursByEmployee: ProjectHoursByEmployee[];
  costs: ProjectCost[];
}

export interface ProjectDashboard {
  activeProjects: number;
  totalProjects: number;
  overdueProjects: number;
  totals: ProjectTotals;
  hoursMonthMinutes: number;
  monthLabel: string;
  topProjects: { id: string; name: string; clientName: string; totalCost: number; totalMinutes: number }[];
}

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectCostInput = z.infer<typeof createProjectCostSchema>;
export type PayProjectCostInput = z.infer<typeof payProjectCostSchema>;
