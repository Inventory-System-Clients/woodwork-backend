import { Router } from "express";
import { productionController } from "../controllers/production.controller";
import { productionShareController } from "../controllers/production-share.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createProductionSchema } from "../models/production.model";

const productionRoutes = Router();

productionRoutes.get("/", requireAuth, productionController.list);
productionRoutes.post(
  "/",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  validateBody(createProductionSchema),
  productionController.create,
);
productionRoutes.patch(
  "/:id/advance-status",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.advanceStatus,
);
productionRoutes.patch(
  "/:id/complete",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.complete,
);
productionRoutes.patch(
  "/:id/approve",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.complete,
);
productionRoutes.post(
  "/:id/share-link",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionShareController.createShareLink,
);
productionRoutes.post(
  "/:id/share",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionShareController.createShareLink,
);
productionRoutes.get("/public/:token", productionShareController.getPublicProductionByToken);
productionRoutes.get("/shared/:token", productionShareController.getPublicProductionByToken);

export { productionRoutes };
