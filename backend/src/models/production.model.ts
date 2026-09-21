import { z } from "zod";

const deliveryDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "deliveryDate must be a valid date",
  });

export const productionStatusSchema = z.string().trim().min(1, "productionStatus is required");

const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

export const listProductionsQuerySchema = z.object({
  active: queryBooleanSchema,
});

export type ProductionStatus = z.infer<typeof productionStatusSchema>;

export interface ProductionStageOption {
  id: string;
  name: string;
  normalizedName: string;
  usageCount: number;
}

export interface ProductionStatusAssignment {
  id: string;
  stageId: string;
  stageName: string;
  teamId: string | null;
  teamName: string | null;
  createdAt: string;
}

export const productionMaterialSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  productName: z.string().trim().min(1, "productName is required").max(255),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  unit: z.string().trim().min(1, "unit is required").max(80),
  unitPrice: z.coerce.number().nonnegative("unitPrice cannot be negative").optional().nullable(),
});

export const productionExpenseSchema = z.object({
  description: z.string().trim().min(1, "description is required").max(255),
  category: z.string().trim().max(80).optional().nullable(),
  amount: z.coerce.number().nonnegative("amount cannot be negative"),
});

export const createProductionSchema = z.object({
  clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  deliveryDate: deliveryDateSchema.optional().nullable(),
  installationTeamId: z.string().trim().min(1, "installationTeamId is required"),
  initialCost: z.coerce.number().nonnegative("initialCost cannot be negative").default(0),
  // Materials, expenses, profit and commission can be added later, while editing the production.
  materials: z.array(productionMaterialSchema).default([]),
  expenses: z.array(productionExpenseSchema).default([]),
});

const percentSchema = z.coerce
  .number()
  .min(0, "percent cannot be negative")
  .max(100, "percent cannot exceed 100");

export const updateProductionSchema = z
  .object({
    clientName: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    deliveryDate: deliveryDateSchema.nullable().optional(),
    installationTeamId: z.string().trim().min(1).optional(),
    initialCost: z.coerce.number().nonnegative("initialCost cannot be negative").optional(),
    profitPercent: percentSchema.optional(),
    commissionPercent: percentSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

// Replaces the whole material list (may be empty).
export const setProductionMaterialsSchema = z.object({
  materials: z.array(productionMaterialSchema).max(500),
});

export const updateProductionExpenseSchema = productionExpenseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const productionStatusInputSchema = z
  .object({
    stageId: z.string().trim().min(1).optional(),
    stageName: z.string().trim().min(1).max(120).optional(),
    teamId: z.string().trim().min(1, "teamId is required"),
  })
  .refine((payload) => Boolean(payload.stageId || payload.stageName), {
    message: "stageId or stageName is required",
  });

export const setProductionStatusesSchema = z.object({
  statuses: z.array(productionStatusInputSchema).min(1, "At least one status is required"),
});

export const advanceProductionStatusSchema = productionStatusInputSchema;

export interface ProductionMaterial {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Production {
  id: string;
  budgetId?: string | null;
  clientName: string;
  description: string;
  productionStatus: ProductionStatus;
  statuses: ProductionStatusAssignment[];
  deliveryDate: string | null;
  installationTeamId: string | null;
  installationTeam: string | null;
  initialCost: number;
  materials: ProductionMaterial[];
}

export interface ProductionExpense {
  id: string;
  productionId: string;
  description: string;
  category: string | null;
  amount: number;
  createdAt: string;
}

export interface ProductionCostReportMaterial {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface ProductionCostReport {
  production: {
    id: string;
    clientName: string;
    description: string;
    productionStatus: string;
    deliveryDate: string | null;
  };
  isFinal: boolean;
  generatedAt: string;
  initialCost: number;
  materials: ProductionCostReportMaterial[];
  materialsTotal: number;
  expenses: ProductionExpense[];
  expensesTotal: number;
  totalSpent: number;
  balance: number;
  profitPercent: number;
  commissionPercent: number;
  /** profitPercent applied over totalSpent. */
  profitValue: number;
  /** commissionPercent applied over profitValue. */
  commissionValue: number;
  netProfit: number;
  salePrice: number;
}

export type ProductionExpenseInput = z.infer<typeof productionExpenseSchema>;
export type CreateProductionInput = z.infer<typeof createProductionSchema>;
export type AdvanceProductionStatusInput = z.infer<typeof advanceProductionStatusSchema>;
export type SetProductionStatusesInput = z.infer<typeof setProductionStatusesSchema>;
export type ListProductionsQueryInput = z.infer<typeof listProductionsQuerySchema>;

export type UpdateProductionInput = z.infer<typeof updateProductionSchema>;
export type SetProductionMaterialsInput = z.infer<typeof setProductionMaterialsSchema>;
export type UpdateProductionExpenseInput = z.infer<typeof updateProductionExpenseSchema>;
