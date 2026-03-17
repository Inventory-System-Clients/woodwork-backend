import { LogisticsSummary } from "../models/logistics.model";
import { logisticsRepository } from "../repositories/logistics.repository";

async function getLogisticsSummary(): Promise<LogisticsSummary> {
  return logisticsRepository.getSummary();
}

export const logisticsService = {
  getLogisticsSummary,
};
