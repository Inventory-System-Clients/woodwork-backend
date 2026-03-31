import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { listBudgetsQuerySchema } from "../models/budget.model";
import { budgetService } from "../services/budget.service";

function toOptionalQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listBudgetsQuerySchema.parse({
    status: toOptionalQueryString(req.query.status),
    startDate: toOptionalQueryString(req.query.startDate),
    endDate: toOptionalQueryString(req.query.endDate),
    clientName: toOptionalQueryString(req.query.clientName),
    page: toOptionalQueryString(req.query.page),
    limit: toOptionalQueryString(req.query.limit),
  });

  const budgets = await budgetService.listBudgets(query);
  res.status(200).json(budgets);
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const budget = await budgetService.getBudgetById(req.params.id);
  res.status(200).json({ data: budget });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const budget = await budgetService.createBudget(req.body);
  res.status(201).json({ data: budget });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const budget = await budgetService.updateBudget(req.params.id, req.body);
  res.status(200).json({ data: budget });
});

const approve = asyncHandler(async (req: Request, res: Response) => {
  const budget = await budgetService.approveBudget(req.params.id);
  res.status(200).json({ data: budget });
});

export const budgetController = {
  list,
  getById,
  create,
  update,
  approve,
};
