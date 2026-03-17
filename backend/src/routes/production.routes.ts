import { Router } from "express";
import { productionController } from "../controllers/production.controller";
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
  "/:id/complete",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.complete,
);

export { productionRoutes };
