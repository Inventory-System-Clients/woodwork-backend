import {
  AdvanceProductionStatusInput,
  CreateProductionInput,
  Production,
  ProductionCostReport,
  ProductionExpense,
  ProductionExpenseInput,
  ProductionStageOption,
  SetProductionMaterialsInput,
  SetProductionStatusesInput,
  UpdateProductionExpenseInput,
  UpdateProductionInput,
} from "../models/production.model";
import { employeeRepository } from "../repositories/employee.repository";
import { productionExpenseRepository } from "../repositories/production-expense.repository";
import { productionRepository } from "../repositories/production.repository";
import { teamRepository } from "../repositories/team.repository";
import { AppError } from "../utils/app-error";

async function listProductions(employeeId?: string, activeOnly = false): Promise<Production[]> {
  if (employeeId) {
    const employee = await employeeRepository.findById(employeeId);

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }
  }

  return productionRepository.findAll({
    employeeId,
    activeOnly,
  });
}

async function updateProduction(id: string, payload: UpdateProductionInput): Promise<Production> {
  let installationTeam: string | undefined;

  if (payload.installationTeamId) {
    const team = await teamRepository.findById(payload.installationTeamId);

    if (!team) {
      throw new AppError("Team not found", 400);
    }

    installationTeam = team.name;
  }

  const updated = await productionRepository.updateDetails(id, { ...payload, installationTeam });

  if (!updated) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return ensureProductionExists(id);
}

async function setMaterials(id: string, payload: SetProductionMaterialsInput): Promise<Production> {
  const updated = await productionRepository.replaceMaterials(id, payload.materials);

  if (!updated) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return ensureProductionExists(id);
}

async function updateExpense(
  productionId: string,
  expenseId: string,
  payload: UpdateProductionExpenseInput,
): Promise<ProductionExpense> {
  const expense = await productionExpenseRepository.update(productionId, expenseId, payload);

  if (!expense) {
    throw new AppError("Expense not found", 404, { productionId, expenseId });
  }

  return expense;
}

async function createProduction(payload: CreateProductionInput): Promise<Production> {
  const team = await teamRepository.findById(payload.installationTeamId);

  if (!team) {
    throw new AppError("Team not found", 400);
  }

  return productionRepository.create({
    ...payload,
    installationTeam: team.name,
  });
}

async function listProductionStatusOptions(): Promise<ProductionStageOption[]> {
  return productionRepository.listStatusOptions();
}

async function completeProduction(id: string): Promise<Production> {
  const production = await productionRepository.complete(id);

  if (!production) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return production;
}

async function setProductionStatuses(id: string, payload: SetProductionStatusesInput): Promise<Production> {
  const production = await productionRepository.setStatuses(id, payload);

  if (!production) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return production;
}

async function advanceProductionStatus(
  id: string,
  payload: AdvanceProductionStatusInput,
  options: { allowApproval?: boolean } = {},
): Promise<Production> {
  const production = await productionRepository.advanceStatus(id, payload, options);

  if (!production) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return production;
}

async function deleteProduction(id: string): Promise<void> {
  const deleted = await productionRepository.remove(id);

  if (!deleted) {
    throw new AppError("Production not found", 404, { productionId: id });
  }
}

async function ensureProductionExists(id: string): Promise<Production> {
  const production = await productionRepository.listById(id);

  if (!production) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return production;
}

async function listExpenses(productionId: string): Promise<ProductionExpense[]> {
  await ensureProductionExists(productionId);
  return productionExpenseRepository.listByProductionId(productionId);
}

async function addExpense(productionId: string, payload: ProductionExpenseInput): Promise<ProductionExpense> {
  await ensureProductionExists(productionId);
  return productionExpenseRepository.create(productionId, payload);
}

async function deleteExpense(productionId: string, expenseId: string): Promise<void> {
  const deleted = await productionExpenseRepository.remove(productionId, expenseId);

  if (!deleted) {
    throw new AppError("Expense not found", 404, { productionId, expenseId });
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getCostReport(productionId: string): Promise<ProductionCostReport> {
  const production = await ensureProductionExists(productionId);
  const expenses = await productionExpenseRepository.listByProductionId(productionId);

  const materials = production.materials.map((material) => ({
    productName: material.productName,
    quantity: material.quantity,
    unit: material.unit,
    unitPrice: material.unitPrice,
    subtotal: roundMoney(material.quantity * material.unitPrice),
  }));

  const materialsTotal = roundMoney(materials.reduce((sum, material) => sum + material.subtotal, 0));
  const expensesTotal = roundMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0));
  const totalSpent = roundMoney(materialsTotal + expensesTotal);
  const { profitPercent, commissionPercent } = await productionRepository.getFinancialPercents(productionId);
  const profitValue = roundMoney((totalSpent * profitPercent) / 100);
  const commissionValue = roundMoney((profitValue * commissionPercent) / 100);

  return {
    production: {
      id: production.id,
      clientName: production.clientName,
      description: production.description,
      productionStatus: production.productionStatus,
      deliveryDate: production.deliveryDate,
    },
    isFinal: productionRepository.isFinishedStatus(production.productionStatus),
    generatedAt: new Date().toISOString(),
    initialCost: production.initialCost,
    materials,
    materialsTotal,
    expenses,
    expensesTotal,
    totalSpent,
    balance: roundMoney(production.initialCost - totalSpent),
    profitPercent,
    commissionPercent,
    profitValue,
    commissionValue,
    netProfit: roundMoney(profitValue - commissionValue),
    salePrice: roundMoney(totalSpent + profitValue),
  };
}

/** Employees must never receive costs or prices. */
function hideCosts(production: Production): Production {
  return {
    ...production,
    initialCost: 0,
    materials: production.materials.map((material) => ({ ...material, unitPrice: 0 })),
  };
}

/** Returns the production only if it belongs to one of the employee's teams; otherwise throws 403. */
async function getProductionAssignedToEmployee(productionId: string, employeeId: string): Promise<Production> {
  const assigned = await productionRepository.findAll({ employeeId });
  const production = assigned.find((item) => item.id === productionId);

  if (!production) {
    throw new AppError("Production is not assigned to your teams", 403, { productionId });
  }

  return production;
}

export const productionService = {
  updateProduction,
  setMaterials,
  updateExpense,
  hideCosts,
  getProductionAssignedToEmployee,
  listExpenses,
  addExpense,
  deleteExpense,
  getCostReport,
  deleteProduction,
  listProductions,
  listProductionStatusOptions,
  createProduction,
  completeProduction,
  setProductionStatuses,
  advanceProductionStatus,
};
