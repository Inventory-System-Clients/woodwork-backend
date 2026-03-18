import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { ProductionShareLinkResult, PublicProductionView } from "../models/production-share.model";
import { productionShareRepository } from "../repositories/production-share.repository";
import { AppError } from "../utils/app-error";

const SHARE_LINK_TTL_DAYS = 30;

function buildTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildPublicShareUrl(token: string): string {
  const relativePath = `/acompanhar-producao/${token}`;
  const configuredBaseUrl = env.FRONTEND_PUBLIC_BASE_URL.trim();

  if (!configuredBaseUrl) {
    return relativePath;
  }

  return `${configuredBaseUrl.replace(/\/$/, "")}${relativePath}`;
}

async function createProductionShareLink(
  productionId: string,
  createdByUserId: string,
): Promise<ProductionShareLinkResult> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = buildTokenHash(token);
  const expiresAtDate = new Date(Date.now() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  const shareLink = await productionShareRepository.createShareLink({
    productionId,
    tokenHash,
    createdByUserId,
    expiresAt: expiresAtDate,
  });

  if (!shareLink) {
    throw new AppError("Production not found", 404, { productionId });
  }

  return {
    token,
    url: buildPublicShareUrl(token),
    expiresAt: expiresAtDate.toISOString(),
  };
}

async function getPublicProductionByToken(token: string): Promise<PublicProductionView> {
  const tokenHash = buildTokenHash(token);
  const production = await productionShareRepository.findPublicProductionByTokenHash(tokenHash);

  if (!production) {
    throw new AppError("Shared production not found", 404);
  }

  return production;
}

export const productionShareService = {
  createProductionShareLink,
  getPublicProductionByToken,
};
