import { z } from "zod";

const deliveryDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "deliveryDate must be a valid date",
  });

export const productionStatusSchema = z.string().trim().min(1, "productionStatus is required");

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

export const createProductionSchema = z.object({
  clientName: z.string().trim().min(2, "clientName must have at least 2 characters").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  deliveryDate: deliveryDateSchema.optional().nullable(),
  installationTeamId: z.string().trim().min(1, "installationTeamId is required"),
  initialCost: z.coerce.number().nonnegative("initialCost cannot be negative").default(0),
  materials: z.array(productionMaterialSchema).min(1, "At least one material is required"),
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

export type CreateProductionInput = z.infer<typeof createProductionSchema>;
export type AdvanceProductionStatusInput = z.infer<typeof advanceProductionStatusSchema>;
export type SetProductionStatusesInput = z.infer<typeof setProductionStatusesSchema>;
