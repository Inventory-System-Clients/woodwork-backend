import { z } from "zod";

const deliveryDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "deliveryDate must be a valid date",
  });

export const productionMaterialSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  productName: z.string().trim().min(1, "productName is required").max(255),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  unit: z.string().trim().min(1, "unit is required").max(80),
});

export const createProductionSchema = z.object({
  clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  deliveryDate: deliveryDateSchema.optional().nullable(),
  installationTeamId: z.string().trim().min(1, "installationTeamId is required"),
  initialCost: z.coerce.number().nonnegative("initialCost cannot be negative").default(0),
  materials: z.array(productionMaterialSchema).min(1, "At least one material is required"),
});

export interface ProductionMaterial {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface Production {
  id: string;
  clientName: string;
  description: string;
  productionStatus: string;
  deliveryDate: string | null;
  installationTeamId: string | null;
  installationTeam: string | null;
  initialCost: number;
  materials: ProductionMaterial[];
}

export type CreateProductionInput = z.infer<typeof createProductionSchema>;
