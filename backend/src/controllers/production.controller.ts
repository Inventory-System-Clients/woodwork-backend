import { Request, Response } from "express";
import { productionService } from "../services/production.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (req: Request, res: Response) => {
  const employeeIdQuery = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
  const employeeId = req.authUser?.role === "funcionario" ? req.authUser.id : employeeIdQuery;

  const productions = await productionService.listProductions(employeeId);
  res.status(200).json({ data: productions });
});

const listStatusOptions = asyncHandler(async (_req: Request, res: Response) => {
  const options = await productionService.listProductionStatusOptions();
  res.status(200).json({ data: options });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.createProduction(req.body);
  res.status(201).json({ data: production });
});

const complete = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.completeProduction(req.params.id);
  res.status(200).json({ data: production });
});

const advanceStatus = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.advanceProductionStatus(req.params.id, req.body);
  res.status(200).json({ data: production });
});

const setStatuses = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.setProductionStatuses(req.params.id, req.body);
  res.status(200).json({ data: production });
});

export const productionController = {
  list,
  listStatusOptions,
  create,
  complete,
  setStatuses,
  advanceStatus,
};
