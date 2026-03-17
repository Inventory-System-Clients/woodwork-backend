import { Request, Response } from "express";
import { logisticsService } from "../services/logistics.service";
import { asyncHandler } from "../utils/async-handler";

const summary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await logisticsService.getLogisticsSummary();
  res.status(200).json({ data });
});

export const logisticsController = {
  summary,
};
