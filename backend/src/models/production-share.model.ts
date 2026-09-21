import { ProductionStatus, ProductionStatusAssignment } from "./production.model";

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

/** Registered project cost shown to the client (commissions are never included). */
export interface PublicProductionItem {
  id: string;
  name: string;
  amount: number;
}

export interface PublicProductionView {
  id: string;
  clientName: string;
  description: string;
  productionStatus: ProductionStatus;
  statuses: ProductionStatusAssignment[];
  deliveryDate: string | null;
  installationTeam: string | null;
  materials: PublicProductionMaterial[];
  items: PublicProductionItem[];
  images: PublicProductionImage[];
  observations: string | null;
  /** Project status (Em andamento / Pausado / Finalizado). */
  projectStatus: string | null;
  lastUpdateAt: string | null;
  updatedAt: string;
}
