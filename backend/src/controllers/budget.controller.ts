import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { listBudgetsQuerySchema, listExpenseDepartmentsQuerySchema } from "../models/budget.model";
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
    category: toOptionalQueryString(req.query.category),
    startDate: toOptionalQueryString(req.query.startDate),
    endDate: toOptionalQueryString(req.query.endDate),
    clientName: toOptionalQueryString(req.query.clientName),
    page: toOptionalQueryString(req.query.page),
    limit: toOptionalQueryString(req.query.limit),
  });

  const budgets = await budgetService.listBudgets(query);
  res.status(200).json(budgets);
});

const listExpenseDepartments = asyncHandler(async (req: Request, res: Response) => {
  const query = listExpenseDepartmentsQuerySchema.parse({
    search: toOptionalQueryString(req.query.search),
  });

  const items = await budgetService.listExpenseDepartmentsCatalog(query);
  res.status(200).json({ data: items });
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
  listExpenseDepartments,
  getById,
  create,
  update,
  approve,
};
