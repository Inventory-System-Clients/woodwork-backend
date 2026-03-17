import { AppError } from "../utils/app-error";
import {
  Budget,
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

async function listBudgets(): Promise<Budget[]> {
  return budgetRepository.findAll();
}

async function getBudgetById(id: string): Promise<Budget> {
  const budget = await budgetRepository.findById(id);

  if (!budget) {
    throw new AppError("Budget not found", 404);
  }

  return budget;
}

async function createBudget(payload: CreateBudgetInput): Promise<Budget> {
  return budgetRepository.create(payload);
}

async function updateBudget(id: string, payload: UpdateBudgetInput): Promise<Budget> {
  const existingBudget = await budgetRepository.findById(id);

  if (!existingBudget) {
    throw new AppError("Budget not found", 404);
  }

  const nextStatus = payload.status ?? existingBudget.status;
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
    status: nextStatus,
    deliveryDate: payload.deliveryDate !== undefined ? payload.deliveryDate : existingBudget.deliveryDate,
    totalPrice: payload.totalPrice ?? existingBudget.totalPrice,
    notes: payload.notes !== undefined ? payload.notes : existingBudget.notes,
    approvedAt: resolveApprovedAt(existingBudget.status, nextStatus, existingBudget.approvedAt),
    materials: nextMaterials,
  });

  if (!updatedBudget) {
    throw new AppError("Budget not found", 404);
  }

  return updatedBudget;
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
