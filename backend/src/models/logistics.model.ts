export interface LogisticsSummaryProductionStats {
  activeCount: number;
  overdueCount: number;
  nearDeadlineCount: number;
  onTimeCount: number;
}

export interface LogisticsSummaryTopMaterial {
  productId: string;
  productName: string;
  unit: string;
  totalQuantity: number;
}

export interface LogisticsSummary {
  teamsCount: number;
  activeEmployeesCount: number;
  productions: LogisticsSummaryProductionStats;
  topMaterials: LogisticsSummaryTopMaterial[];
  activeProductionsTotalCost: number;
}
