import { Request, Response } from "express";
import { productionShareService } from "../services/production-share.service";
import { asyncHandler } from "../utils/async-handler";

const createShareLink = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.authUser?.id;

  if (!authUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const shareLink = await productionShareService.createProductionShareLink(req.params.id, authUserId);
  res.status(200).json({ data: shareLink });
});

const getPublicProductionByToken = asyncHandler(async (req: Request, res: Response) => {
  const production = await productionShareService.getPublicProductionByToken(req.params.token);
  res.status(200).json({ data: production });
});

export const productionShareController = {
  createShareLink,
  getPublicProductionByToken,
};
