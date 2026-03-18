import { Request, Response } from "express";
import { productionShareService } from "../services/production-share.service";
import { asyncHandler } from "../utils/async-handler";

function sanitizeInlineFilename(fileName: string): string {
  return fileName.replace(/[\r\n"]/g, "_");
}

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

const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.authUser?.id;
  const productionId = req.params.id;
  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

  console.info("[production-share][controller][uploadImages] Request", {
    productionId,
    authUserId: authUserId ?? null,
    filesCount: files.length,
  });

  if (!authUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const images = await productionShareService.uploadProductionImages(productionId, authUserId, files);

  console.info("[production-share][controller][uploadImages] Success", {
    productionId,
    createdCount: images.length,
  });

  res.status(201).json({ data: images });
});

const listImages = asyncHandler(async (req: Request, res: Response) => {
  const productionId = req.params.id;

  const images = await productionShareService.listProductionImages(productionId);
  res.status(200).json({ data: images });
});

const getPublicProductionImageByToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.params.token;
  const imageId = req.params.imageId;
  const image = await productionShareService.getPublicProductionImageByToken(token, imageId);

  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Content-Length", String(image.fileSize));
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Disposition", `inline; filename="${sanitizeInlineFilename(image.fileName)}"`);
  res.status(200).send(image.data);
});

export const productionShareController = {
  createShareLink,
  getPublicProductionByToken,
  uploadImages,
  listImages,
  getPublicProductionImageByToken,
};
