import {
  ActiveProductionMaterialConsumptionResponse,
  LogisticsDateFilterQueryInput,
  LogisticsSummary,
} from "../models/logistics.model";
import { logisticsRepository } from "../repositories/logistics.repository";

async function getLogisticsSummary(): Promise<LogisticsSummary> {
  return logisticsRepository.getSummary();
}

async function getActiveProductionsMaterialConsumption(
  query: LogisticsDateFilterQueryInput,
): Promise<ActiveProductionMaterialConsumptionResponse> {
  return logisticsRepository.getActiveProductionsMaterialConsumption(query);
}

export const logisticsService = {
  getLogisticsSummary,
  getActiveProductionsMaterialConsumption,
};
