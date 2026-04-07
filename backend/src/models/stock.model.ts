import { z } from "zod";

export const stockMovementTypeSchema = z.enum(["entrada", "saida"]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

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

const isoDateQuerySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must follow YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: "Date must be valid",
  });

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
  referenceType: z.string().trim().min(1).max(80).optional(),
  activeOnly: queryBooleanSchema,
  startDate: isoDateQuerySchema.optional(),
  endDate: isoDateQuerySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
  .refine(
    (payload) => {
      if (!payload.startDate || !payload.endDate) {
        return true;
      }

      return payload.startDate <= payload.endDate;
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["startDate"],
    },
  );

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
