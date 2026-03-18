import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import {
  ProductionImage,
  ProductionImageUploadInput,
  ProductionShareLinkResult,
  PublicProductionImageFile,
  PublicProductionView,
} from "../models/production-share.model";
import { productionShareRepository } from "../repositories/production-share.repository";
import { AppError } from "../utils/app-error";

const SHARE_LINK_TTL_DAYS = 30;

function buildTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenHashPrefix(value: string): string {
  return value.slice(0, 12);
}

function buildPublicShareUrl(token: string): string {
  const relativePath = `/acompanhar-producao/${token}`;
  const configuredBaseUrl = env.FRONTEND_PUBLIC_BASE_URL.trim();

  if (!configuredBaseUrl) {
    return relativePath;
  }

  return `${configuredBaseUrl.replace(/\/$/, "")}${relativePath}`;
}

function buildPublicImageUrl(token: string, imageId: string): string {
  return `/api/public/productions/${encodeURIComponent(token)}/images/${encodeURIComponent(imageId)}`;
}

function mapUploadInput(file: Express.Multer.File): ProductionImageUploadInput {
  return {
    fileName: file.originalname || `production-image-${Date.now()}`,
    mimeType: file.mimetype,
    fileSize: file.size,
    data: file.buffer,
  };
}

function withPublicImageUrls(token: string, production: PublicProductionView): PublicProductionView {
  return {
    ...production,
    images: production.images.map((image) => ({
      ...image,
      url: buildPublicImageUrl(token, image.id),
    })),
  };
}

async function createProductionShareLink(
  productionId: string,
  createdByUserId: string,
): Promise<ProductionShareLinkResult> {
  console.info("[production-share][service][createProductionShareLink] Requested", {
    productionId,
    createdByUserId,
  });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = buildTokenHash(token);
  const expiresAtDate = new Date(Date.now() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  let shareLink;

  try {
    shareLink = await productionShareRepository.createShareLink({
      productionId,
      tokenHash,
      createdByUserId,
      expiresAt: expiresAtDate,
    });
  } catch (error) {
    console.error("[production-share][service][createProductionShareLink] Repository failed", {
      productionId,
      createdByUserId,
      tokenHashPrefix: tokenHashPrefix(tokenHash),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!shareLink) {
    console.warn("[production-share][service][createProductionShareLink] Production not found", {
      productionId,
    });
    throw new AppError("Production not found", 404, { productionId });
  }

  console.info("[production-share][service][createProductionShareLink] Link generated", {
    productionId,
    tokenHashPrefix: tokenHashPrefix(tokenHash),
    expiresAt: expiresAtDate.toISOString(),
  });

  return {
    token,
    url: buildPublicShareUrl(token),
    expiresAt: expiresAtDate.toISOString(),
  };
}

async function getPublicProductionByToken(token: string): Promise<PublicProductionView> {
  const tokenHash = buildTokenHash(token);

  console.info("[production-share][service][getPublicProductionByToken] Requested", {
    tokenLength: token.length,
    tokenHashPrefix: tokenHashPrefix(tokenHash),
  });

  let production;

  try {
    production = await productionShareRepository.findPublicProductionByTokenHash(tokenHash);
  } catch (error) {
    console.error("[production-share][service][getPublicProductionByToken] Repository failed", {
      tokenLength: token.length,
      tokenHashPrefix: tokenHashPrefix(tokenHash),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!production) {
    console.warn("[production-share][service][getPublicProductionByToken] Token not found", {
      tokenLength: token.length,
      tokenHashPrefix: tokenHashPrefix(tokenHash),
    });
    throw new AppError("Shared production not found", 404);
  }

  console.info("[production-share][service][getPublicProductionByToken] Shared production resolved", {
    tokenHashPrefix: tokenHashPrefix(tokenHash),
    productionId: production.id,
    status: production.productionStatus,
    imagesCount: production.images.length,
  });

  return withPublicImageUrls(token, production);
}

async function uploadProductionImages(
  productionId: string,
  createdByUserId: string,
  files: Express.Multer.File[],
): Promise<ProductionImage[]> {
  console.info("[production-share][service][uploadProductionImages] Requested", {
    productionId,
    createdByUserId,
    filesCount: files.length,
  });

  if (files.length === 0) {
    throw new AppError("At least one image file is required", 400);
  }

  const invalidFile = files.find((file) => !file.mimetype.startsWith("image/"));

  if (invalidFile) {
    throw new AppError("Only image files are allowed", 400, {
      fileName: invalidFile.originalname,
      mimeType: invalidFile.mimetype,
    });
  }

  const uploadInput = files.map(mapUploadInput);

  let createdImages;

  try {
    createdImages = await productionShareRepository.createProductionImages({
      productionId,
      createdByUserId,
      images: uploadInput,
    });
  } catch (error) {
    console.error("[production-share][service][uploadProductionImages] Repository failed", {
      productionId,
      createdByUserId,
      filesCount: files.length,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!createdImages) {
    throw new AppError("Production not found", 404, { productionId });
  }

  console.info("[production-share][service][uploadProductionImages] Success", {
    productionId,
    createdCount: createdImages.length,
  });

  return createdImages;
}

async function listProductionImages(productionId: string): Promise<ProductionImage[]> {
  const images = await productionShareRepository.listProductionImages(productionId);

  if (!images) {
    throw new AppError("Production not found", 404, { productionId });
  }

  return images;
}

async function getPublicProductionImageByToken(
  token: string,
  imageId: string,
): Promise<PublicProductionImageFile> {
  const tokenHash = buildTokenHash(token);

  const image = await productionShareRepository.findPublicProductionImageFileByTokenHash(tokenHash, imageId);

  if (!image) {
    throw new AppError("Shared production image not found", 404);
  }

  return image;
}

export const productionShareService = {
  createProductionShareLink,
  getPublicProductionByToken,
  uploadProductionImages,
  listProductionImages,
  getPublicProductionImageByToken,
};
