import { Request, Response } from "express";
import { productionShareService } from "../services/production-share.service";
import { asyncHandler } from "../utils/async-handler";

const createShareLink = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.authUser?.id;
  const productionId = req.params.id;

  console.info("[production-share][controller][createShareLink] Request", {
    productionId,
    authUserId: authUserId ?? null,
    route: req.route?.path,
  });

  if (!authUserId) {
    console.warn("[production-share][controller][createShareLink] Unauthorized request", {
      productionId,
    });
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const shareLink = await productionShareService.createProductionShareLink(productionId, authUserId);

  console.info("[production-share][controller][createShareLink] Success", {
    productionId,
    expiresAt: shareLink.expiresAt,
  });

  res.status(200).json({ data: shareLink });
});

const getPublicProductionByToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.params.token;

  console.info("[production-share][controller][getPublicByToken] Request", {
    tokenLength: token.length,
    route: req.route?.path,
  });

  const production = await productionShareService.getPublicProductionByToken(token);

  console.info("[production-share][controller][getPublicByToken] Success", {
    tokenLength: token.length,
    productionId: production.id,
    status: production.productionStatus,
  });

  res.status(200).json({ data: production });
});

export const productionShareController = {
  createShareLink,
  getPublicProductionByToken,
};
