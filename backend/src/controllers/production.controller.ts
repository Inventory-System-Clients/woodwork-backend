import { Request, Response } from "express";
import { listProductionsQuerySchema } from "../models/production.model";
import { productionService } from "../services/production.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (req: Request, res: Response) => {
  const employeeIdQuery = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
  const employeeId = req.authUser?.role === "funcionario" ? req.authUser.id : employeeIdQuery;
  const query = listProductionsQuerySchema.parse({
    active: req.query.active,
  });

  const productions = await productionService.listProductions(employeeId, query.active ?? false);

  if (req.authUser?.role === "funcionario") {
    res.status(200).json({ data: productions.map(productionService.hideCosts) });
    return;
  }

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
  if (req.authUser?.role === "funcionario") {
    // Employees advance stages only on their own teams' productions, always as that team, and cannot approve.
    const assigned = await productionService.getProductionAssignedToEmployee(req.params.id, req.authUser.id);
    const payload = assigned.installationTeamId
      ? { ...req.body, teamId: assigned.installationTeamId }
      : req.body;

    const production = await productionService.advanceProductionStatus(req.params.id, payload, {
      allowApproval: false,
    });

    res.status(200).json({ data: productionService.hideCosts(production) });
    return;
  }

  const production = await productionService.advanceProductionStatus(req.params.id, req.body);
  res.status(200).json({ data: production });
});

const setStatuses = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionService.setProductionStatuses(req.params.id, req.body);
  res.status(200).json({ data: production });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  await productionService.deleteProduction(req.params.id);
  res.status(200).json({ data: { id: req.params.id } });
});

const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const expenses = await productionService.listExpenses(req.params.id);
  res.status(200).json({ data: expenses });
});

const addExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await productionService.addExpense(req.params.id, req.body);
  res.status(201).json({ data: expense });
});

const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await productionService.deleteExpense(req.params.id, req.params.expenseId);
  res.status(200).json({ data: { id: req.params.expenseId } });
});

const getCostReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await productionService.getCostReport(req.params.id);
  res.status(200).json({ data: report });
});

export const productionController = {
  listExpenses,
  addExpense,
  deleteExpense,
  getCostReport,
  remove,
  list,
  listStatusOptions,
  create,
  complete,
  setStatuses,
  advanceStatus,
};
