import {
  CreateFechamentoInput,
  Fechamento,
  ListFechamentosQueryInput,
  LogisticsSummary,
} from "../models/logistics.model";
import { logisticsRepository } from "../repositories/logistics.repository";

async function getLogisticsSummary(): Promise<LogisticsSummary> {
  return logisticsRepository.getSummary();
}

async function listFechamentos(query: ListFechamentosQueryInput): Promise<Fechamento[]> {
  return logisticsRepository.listFechamentos(query);
}

async function createFechamento(payload: CreateFechamentoInput): Promise<Fechamento> {
  return logisticsRepository.upsertFechamento(payload);
}

export const logisticsService = {
  getLogisticsSummary,
  listFechamentos,
  createFechamento,
};
