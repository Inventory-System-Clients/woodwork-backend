import { Router } from "express";
import { productionShareController } from "../controllers/production-share.controller";

const publicRoutes = Router();

publicRoutes.get("/productions/:token", productionShareController.getPublicProductionByToken);
publicRoutes.get(
	"/productions/:token/images/:imageId",
	productionShareController.getPublicProductionImageByToken,
);

export { publicRoutes };
