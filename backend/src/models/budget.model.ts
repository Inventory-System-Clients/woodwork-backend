import { z } from "zod";

const queryDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date filter must be a valid ISO 8601 date",
  });

const monetarySchema = z.coerce.number().nonnegative("Value cannot be negative");
const profitMarginSchema = z.coerce
  .number()
  .min(0, "profitMargin cannot be negative")
  .max(1, "profitMargin must be in decimal format between 0 and 1");
const estimatedDeliveryBusinessDaysSchema = z
  .number({
    required_error: "Campo estimatedDeliveryBusinessDays e obrigatorio.",
    invalid_type_error: "estimatedDeliveryBusinessDays deve ser um numero inteiro maior que zero.",
  })
  .int("estimatedDeliveryBusinessDays deve ser um numero inteiro maior que zero.")
  .gt(0, "estimatedDeliveryBusinessDays deve ser um numero inteiro maior que zero.");
const paymentTermsSchema = z
  .string({
    invalid_type_error: "paymentTerms deve ser um texto valido.",
  })
  .trim()
  .min(1, "paymentTerms deve ser um texto valido.")
  .max(4000, "paymentTerms deve ter no maximo 4000 caracteres.");

const optionalTextField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional().nullable();

export const budgetStatusSchema = z.enum(["draft", "pending", "pre_approved", "approved", "rejected"]);
export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

export const budgetCategorySchema = z.enum(["arquitetonico", "executivo"]);
export type BudgetCategory = z.infer<typeof budgetCategorySchema>;

export const budgetMaterialSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .transform((value) => value ?? undefined),
  productName: z.string().trim().min(1, "productName is required").max(255),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  unit: z.string().trim().min(1, "unit is required").max(80),
  unitPrice: z.coerce.number().nonnegative("unitPrice cannot be negative").optional().nullable(),
});

export const budgetExpenseDepartmentSchema = z.object({
  expenseDepartmentId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .transform((value) => value ?? undefined),
  name: z.string().trim().min(1, "name is required").max(200),
  sector: z.string().trim().min(1, "sector is required").max(120),
  amount: z.coerce.number().nonnegative("amount cannot be negative"),
});

function normalizeBudgetPayloadAliases(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const payload = { ...(input as Record<string, unknown>) };

  if (payload.paymentTerms === undefined && payload.payment_terms !== undefined) {
    payload.paymentTerms = payload.payment_terms;
  }

  return payload;
}

const createBudgetBaseSchema = z.object({
  clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200),
  category: budgetCategorySchema,
  description: z.string().trim().min(1, "description is required").max(2000),
  estimatedDeliveryBusinessDays: estimatedDeliveryBusinessDaysSchema,
  paymentTerms: paymentTermsSchema.optional().nullable(),
  totalPrice: monetarySchema.default(0),
  totalCost: monetarySchema.optional(),
  costsApplicableValue: monetarySchema.optional(),
  laborCost: monetarySchema.optional(),
  profitMargin: profitMarginSchema.optional(),
  profitValue: monetarySchema.optional(),
  notes: optionalTextField(2000),
  status: budgetStatusSchema.default("pending"),
  materials: z.array(budgetMaterialSchema).min(1, "At least one material is required"),
  expenseDepartments: z.array(budgetExpenseDepartmentSchema).default([]),
});

export const createBudgetSchema = z.preprocess(normalizeBudgetPayloadAliases, createBudgetBaseSchema);

const updateBudgetBaseSchema = z
  .object({
    clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200).optional(),
    category: budgetCategorySchema.optional(),
    description: z.string().trim().min(1, "description is required").max(2000).optional(),
    estimatedDeliveryBusinessDays: estimatedDeliveryBusinessDaysSchema.optional(),
    paymentTerms: paymentTermsSchema.optional().nullable(),
    totalPrice: monetarySchema.optional(),
    totalCost: monetarySchema.optional(),
    costsApplicableValue: monetarySchema.optional(),
    laborCost: monetarySchema.optional(),
    profitMargin: profitMarginSchema.optional(),
    profitValue: monetarySchema.optional(),
    notes: optionalTextField(2000),
    status: budgetStatusSchema.optional(),
    materials: z.array(budgetMaterialSchema).min(1, "At least one material is required").optional(),
    expenseDepartments: z.array(budgetExpenseDepartmentSchema).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const updateBudgetSchema = z.preprocess(normalizeBudgetPayloadAliases, updateBudgetBaseSchema);

export const listBudgetsQuerySchema = z
  .object({
    status: budgetStatusSchema.optional(),
    category: budgetCategorySchema.optional(),
    startDate: queryDateSchema.optional(),
    endDate: queryDateSchema.optional(),
    clientName: z.string().trim().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1, "page must be greater than zero").default(1),
    limit: z.coerce.number().int().min(1, "limit must be greater than zero").max(100).default(20),
  })
  .refine(
    (query) => !query.startDate || !query.endDate || new Date(query.startDate) <= new Date(query.endDate),
    {
      message: "endDate must be greater than or equal to startDate",
      path: ["endDate"],
    },
  );

export const listExpenseDepartmentsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
});

export interface BudgetMaterial {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
}

export interface BudgetExpenseDepartment {
  expenseDepartmentId?: string;
  name: string;
  sector: string;
  amount: number;
}

export interface ExpenseDepartmentCatalogItem {
  id: string;
  name: string;
  sector: string;
  defaultAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetFinancialSummary {
  totalPrice: number;
  totalCost: number;
  costsApplicableValue: number;
  expenseDepartmentsCost: number;
  laborCost: number;
  costsAppliedValue: number;
  costsAppliedAt: string | null;
  remainingCostToApply: number;
  profitMargin: number;
  profitValue: number;
  netProfitValue: number;
}

export interface Budget {
  id: string;
  clientName: string;
  category: BudgetCategory;
  description: string;
  status: BudgetStatus;
  estimatedDeliveryBusinessDays: number | null;
  paymentTerms: string | null;
  deliveryDate: string | null;
  validityBusinessDays: number;
  elapsedBusinessDays: number;
  remainingValidityBusinessDays: number;
  isExpired: boolean;
  totalPrice: number;
  totalCost: number;
  costsApplicableValue: number;
  laborCost: number;
  profitMargin: number;
  profitValue: number;
  netProfitValue: number;
  financialSummary: BudgetFinancialSummary;
  notes: string | null;
  approvedAt: string | null;
  costsAppliedAt: string | null;
  costsAppliedValue: number;
  createdAt: string;
  updatedAt: string;
  materials: BudgetMaterial[];
  expenseDepartments: BudgetExpenseDepartment[];
}

export interface BudgetPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedBudgets {
  data: Budget[];
  pagination: BudgetPagination;
}

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type ListBudgetsQueryInput = z.infer<typeof listBudgetsQuerySchema>;
export type ListExpenseDepartmentsQueryInput = z.infer<typeof listExpenseDepartmentsQuerySchema>;
