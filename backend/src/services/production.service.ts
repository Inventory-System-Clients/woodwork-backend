import { CreateProductionInput, Production } from "../models/production.model";
import { employeeRepository } from "../repositories/employee.repository";
import { productionRepository } from "../repositories/production.repository";
import { teamRepository } from "../repositories/team.repository";
import { AppError } from "../utils/app-error";

async function listProductions(employeeId?: string): Promise<Production[]> {
  if (employeeId) {
    const employee = await employeeRepository.findById(employeeId);

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }
  }

  return productionRepository.findAll(employeeId);
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

async function completeProduction(id: string): Promise<Production> {
  const production = await productionRepository.complete(id);

  if (!production) {
    throw new AppError("Production not found", 404);
  }

  return production;
}

export const productionService = {
  listProductions,
  createProduction,
  completeProduction,
};
