import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { budgetService } from "../services/budget.service";

const list = asyncHandler(async (_req: Request, res: Response) => {
  const budgets = await budgetService.listBudgets();
  res.status(200).json({ data: budgets });
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
