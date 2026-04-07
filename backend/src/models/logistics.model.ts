import { z } from "zod";

export const logisticsDateFilterQuerySchema = z
  .object({
    startDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must follow YYYY-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
        message: "startDate must be valid",
      })
      .optional(),
    endDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must follow YYYY-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
        message: "endDate must be valid",
      })
      .optional(),
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

export const fechamentoReferenceMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "referenceMonth must follow YYYY-MM");

export const createFechamentoSchema = z.object({
  referenceMonth: fechamentoReferenceMonthSchema,
  custoGeralAtivo: z.coerce.number().nonnegative("custoGeralAtivo cannot be negative"),
  receitaVinculada: z.coerce.number().nonnegative("receitaVinculada cannot be negative"),
  lucroLiquido: z.coerce.number(),
  lucroBruto: z.coerce.number(),
  custosAplicadosPreAprovados: z.coerce
    .number()
    .nonnegative("custosAplicadosPreAprovados cannot be negative"),
});

export const listFechamentosQuerySchema = z.object({
  referenceMonth: fechamentoReferenceMonthSchema.optional(),
});

export interface LogisticsSummaryProductionStats {
  activeCount: number;
  overdueCount: number;
  nearDeadlineCount: number;
  onTimeCount: number;
}

export interface LogisticsSummaryTopMaterial {
  productId: string;
  productName: string;
  unit: string;
  totalQuantity: number;
}

export interface LogisticsSummary {
  teamsCount: number;
  activeEmployeesCount: number;
  productions: LogisticsSummaryProductionStats;
  topMaterials: LogisticsSummaryTopMaterial[];
  activeProductionsTotalCost: number;
}

export interface ActiveProductionMaterialConsumptionItem {
  productId: string;
  productName: string;
  unit: string;
  totalQuantityUsed: number;
  activeProductionsCount: number;
}

export interface ActiveProductionMaterialConsumptionResponse {
  data: ActiveProductionMaterialConsumptionItem[];
  meta: {
    startDate: string | null;
    endDate: string | null;
    totalItems: number;
  };
}

export interface Fechamento {
  id: string;
  referenceMonth: string;
  custoGeralAtivo: number;
  receitaVinculada: number;
  lucroLiquido: number;
  lucroBruto: number;
  custosAplicadosPreAprovados: number;
  createdAt: string;
  updatedAt: string;
}

export type LogisticsDateFilterQueryInput = z.infer<typeof logisticsDateFilterQuerySchema>;
export type CreateFechamentoInput = z.infer<typeof createFechamentoSchema>;
export type ListFechamentosQueryInput = z.infer<typeof listFechamentosQuerySchema>;
