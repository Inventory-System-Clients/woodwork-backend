import { z } from "zod";

const deliveryDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "deliveryDate must be a valid date",
  });

const optionalTextField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional().nullable();

export const budgetStatusSchema = z.enum(["draft", "pending", "approved", "rejected"]);
export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

export const budgetMaterialSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  productName: z.string().trim().min(1, "productName is required").max(255),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  unit: z.string().trim().min(1, "unit is required").max(80),
  unitPrice: z.coerce.number().nonnegative("unitPrice cannot be negative").optional().nullable(),
});

export const createBudgetSchema = z.object({
  clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  deliveryDate: deliveryDateSchema.optional().nullable(),
  totalPrice: z.coerce.number().nonnegative("totalPrice cannot be negative").default(0),
  notes: optionalTextField(2000),
  status: budgetStatusSchema.default("pending"),
  materials: z.array(budgetMaterialSchema).min(1, "At least one material is required"),
});

export const updateBudgetSchema = z
  .object({
    clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200).optional(),
    description: z.string().trim().min(1, "description is required").max(2000).optional(),
    deliveryDate: deliveryDateSchema.optional().nullable(),
    totalPrice: z.coerce.number().nonnegative("totalPrice cannot be negative").optional(),
    notes: optionalTextField(2000),
    status: budgetStatusSchema.optional(),
    materials: z.array(budgetMaterialSchema).min(1, "At least one material is required").optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export interface BudgetMaterial {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
}

export interface Budget {
  id: string;
  clientName: string;
  description: string;
  status: BudgetStatus;
  deliveryDate: string | null;
  totalPrice: number;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  materials: BudgetMaterial[];
}

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
