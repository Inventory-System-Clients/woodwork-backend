import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  stockQuantity: z.coerce.number().nonnegative("stockQuantity cannot be negative").default(0),
  lowStockAlertQuantity: z.coerce
    .number()
    .nonnegative("lowStockAlertQuantity cannot be negative")
    .default(0),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(255).optional(),
    lowStockAlertQuantity: z
      .coerce
      .number()
      .nonnegative("lowStockAlertQuantity cannot be negative")
      .optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export interface Product {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockAlertQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
