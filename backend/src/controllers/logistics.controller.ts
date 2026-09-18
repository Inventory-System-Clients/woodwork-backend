import { Request, Response } from "express";
import { listFechamentosQuerySchema } from "../models/logistics.model";
import { logisticsService } from "../services/logistics.service";
import { asyncHandler } from "../utils/async-handler";

function toOptionalQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const summary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await logisticsService.getLogisticsSummary();
  res.status(200).json({ data });
});

const listFechamentos = asyncHandler(async (req: Request, res: Response) => {
  const query = listFechamentosQuerySchema.parse({
    referenceMonth: toOptionalQueryString(req.query.referenceMonth),
  });

  const data = await logisticsService.listFechamentos(query);
  res.status(200).json({ data });
});

const createFechamento = asyncHandler(async (req: Request, res: Response) => {
  const data = await logisticsService.createFechamento(req.body);
  res.status(201).json({ data });
});

export const logisticsController = {
  summary,
  listFechamentos,
  createFechamento,
};
