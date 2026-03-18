import { ProductionStatus } from "./production.model";

export interface ProductionShareLinkResult {
  token: string;
  url: string;
  expiresAt: string;
}

export interface PublicProductionMaterial {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface PublicProductionView {
  id: string;
  clientName: string;
  description: string;
  productionStatus: ProductionStatus;
  deliveryDate: string | null;
  installationTeam: string | null;
  materials: PublicProductionMaterial[];
  observations: string | null;
  updatedAt: string;
}
