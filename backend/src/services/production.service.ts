import { CreateProductionInput, Production } from "../models/production.model";
import { productionRepository } from "../repositories/production.repository";
import { AppError } from "../utils/app-error";

async function listProductions(): Promise<Production[]> {
  return productionRepository.findAll();
}

async function createProduction(payload: CreateProductionInput): Promise<Production> {
  return productionRepository.create(payload);
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
