import { AppError } from "../utils/app-error";
import {
  Budget,
  ListBudgetsQueryInput,
  PaginatedBudgets,
  BudgetStatus,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "../models/budget.model";
import { budgetRepository } from "../repositories/budget.repository";

function resolveApprovedAt(currentStatus: BudgetStatus, nextStatus: BudgetStatus, currentApprovedAt: string | null) {
  void currentStatus;

  if (nextStatus === "approved") {
    return currentApprovedAt ?? new Date().toISOString();
  }

  if (currentApprovedAt !== null) {
    return null;
  }

  return currentApprovedAt;
}

async function listBudgets(query: ListBudgetsQueryInput): Promise<PaginatedBudgets> {
  return budgetRepository.findAll(query);
}

async function getBudgetById(id: string): Promise<Budget> {
  const budget = await budgetRepository.findById(id);

  if (!budget) {
    throw new AppError("Budget not found", 404);
  }

  return budget;
}

async function createBudget(payload: CreateBudgetInput): Promise<Budget> {
  const shouldCreateAsApproved = payload.status === "approved";
  const creationPayload: CreateBudgetInput = shouldCreateAsApproved
    ? {
        ...payload,
        status: "pending",
      }
    : payload;

  const budget = await budgetRepository.create(creationPayload);

  if (!shouldCreateAsApproved) {
    return budget;
  }

  const approvedBudget = await budgetRepository.approve(budget.id);

  if (!approvedBudget) {
    throw new AppError("Budget not found", 404);
  }

  return approvedBudget;
}

async function updateBudget(id: string, payload: UpdateBudgetInput): Promise<Budget> {
  const existingBudget = await budgetRepository.findById(id);

  if (!existingBudget) {
    throw new AppError("Budget not found", 404);
  }

  const nextStatus = payload.status ?? existingBudget.status;
  const shouldApproveOnUpdate = existingBudget.status !== "approved" && nextStatus === "approved";
  const nextMaterials: Budget["materials"] = payload.materials
    ? payload.materials.map((material) => ({
        productId: material.productId,
        productName: material.productName,
        quantity: material.quantity,
        unit: material.unit,
        unitPrice: material.unitPrice ?? null,
      }))
    : existingBudget.materials;

  const updatedBudget = await budgetRepository.save(id, {
    clientName: payload.clientName ?? existingBudget.clientName,
    description: payload.description ?? existingBudget.description,
    status: shouldApproveOnUpdate ? existingBudget.status : nextStatus,
    deliveryDate: payload.deliveryDate !== undefined ? payload.deliveryDate : existingBudget.deliveryDate,
    totalPrice: payload.totalPrice ?? existingBudget.totalPrice,
    totalCost: payload.totalCost ?? existingBudget.totalCost,
    laborCost: payload.laborCost ?? existingBudget.laborCost,
    profitMargin: payload.profitMargin ?? existingBudget.profitMargin,
    profitValue: payload.profitValue ?? existingBudget.profitValue,
    notes: payload.notes !== undefined ? payload.notes : existingBudget.notes,
    approvedAt: shouldApproveOnUpdate
      ? existingBudget.approvedAt
      : resolveApprovedAt(existingBudget.status, nextStatus, existingBudget.approvedAt),
    materials: nextMaterials,
  });

  if (!updatedBudget) {
    throw new AppError("Budget not found", 404);
  }

  if (!shouldApproveOnUpdate) {
    return updatedBudget;
  }

  const approvedBudget = await budgetRepository.approve(id);

  if (!approvedBudget) {
    throw new AppError("Budget not found", 404);
  }

  return approvedBudget;
}

async function approveBudget(id: string): Promise<Budget> {
  const budget = await budgetRepository.approve(id);

  if (!budget) {
    throw new AppError("Budget not found", 404);
  }

  return budget;
}

export const budgetService = {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  approveBudget,
};
