import {
  AdvanceProductionStatusInput,
  CreateProductionInput,
  Production,
  ProductionStageOption,
  SetProductionStatusesInput,
} from "../models/production.model";
import { employeeRepository } from "../repositories/employee.repository";
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

async function advanceProductionStatus(id: string, payload: AdvanceProductionStatusInput): Promise<Production> {
  const production = await productionRepository.advanceStatus(id, payload);

  if (!production) {
    throw new AppError("Production not found", 404, { productionId: id });
  }

  return production;
}

export const productionService = {
  listProductions,
  listProductionStatusOptions,
  createProduction,
  completeProduction,
  setProductionStatuses,
  advanceProductionStatus,
};
