import {
  CreateStockMovementInput,
  ListStockMovementsQueryInput,
  StockMovement,
  StockMovementList,
} from "../models/stock.model";
import { stockRepository } from "../repositories/stock.repository";

async function listStockMovements(query: ListStockMovementsQueryInput): Promise<StockMovementList> {
  return stockRepository.listMovements(query);
}

async function createStockMovement(payload: CreateStockMovementInput): Promise<StockMovement> {
  return stockRepository.createMovement(payload);
}

export const stockService = {
  listStockMovements,
  createStockMovement,
};
