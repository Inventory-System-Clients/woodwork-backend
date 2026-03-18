import { z } from "zod";

export const stockMovementTypeSchema = z.enum(["entrada", "saida"]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const createStockMovementSchema = z.object({
  productId: z.string().trim().min(1, "productId is required"),
  movementType: stockMovementTypeSchema,
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  unit: z.string().trim().min(1).max(80).optional().nullable(),
  reason: z.string().trim().min(2, "reason must have at least 2 characters").max(500),
  referenceType: z.string().trim().min(1).max(80).optional().nullable(),
  referenceId: z.string().trim().min(1).max(120).optional().nullable(),
});

export const listStockMovementsQuerySchema = z.object({
  productId: z.string().trim().min(1).optional(),
  movementType: stockMovementTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantity: number;
  unit: string | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  currentStock: number | null;
  createdAt: string;
}

export interface StockMovementList {
  items: StockMovement[];
  total: number;
  limit: number;
  offset: number;
}

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type ListStockMovementsQueryInput = z.infer<typeof listStockMovementsQuerySchema>;
