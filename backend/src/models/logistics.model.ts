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

export type LogisticsDateFilterQueryInput = z.infer<typeof logisticsDateFilterQuerySchema>;
