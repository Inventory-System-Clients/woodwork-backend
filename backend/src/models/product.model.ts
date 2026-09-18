import { z } from "zod";

const supplierSchema = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  supplier: supplierSchema,
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  supplier: supplierSchema,
});

export interface Product {
  id: string;
  name: string;
  /** Supplier (brand) of the material; null when not informed. */
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
