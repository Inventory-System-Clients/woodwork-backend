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

export interface ProductionImage {
  id: string;
  productionId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ProductionImageUploadInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
}

export interface PublicProductionImage {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  url?: string;
}

export interface PublicProductionImageFile {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
}

export interface PublicProductionView {
  id: string;
  clientName: string;
  description: string;
  productionStatus: ProductionStatus;
  deliveryDate: string | null;
  installationTeam: string | null;
  materials: PublicProductionMaterial[];
  images: PublicProductionImage[];
  observations: string | null;
  updatedAt: string;
}
