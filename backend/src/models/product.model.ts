import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
});

export interface Product {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
