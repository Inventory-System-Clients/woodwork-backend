import { Request, Response } from "express";
import { productionService } from "../services/production.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (_req: Request, res: Response) => {
  const productions = await productionService.listProductions();
  res.status(200).json({ data: productions });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.createProduction(req.body);
  res.status(201).json({ data: production });
});

const complete = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.completeProduction(req.params.id);
  res.status(200).json({ data: production });
});

export const productionController = {
  list,
  create,
  complete,
};
