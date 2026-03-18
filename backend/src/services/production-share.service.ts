import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { ProductionShareLinkResult, PublicProductionView } from "../models/production-share.model";
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
  });

  return production;
}

export const productionShareService = {
  createProductionShareLink,
  getPublicProductionByToken,
};
