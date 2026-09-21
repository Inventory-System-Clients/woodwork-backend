import { Router } from "express";
import { logisticsController } from "../controllers/logistics.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createFechamentoSchema } from "../models/logistics.model";

const logisticsRoutes = Router();

logisticsRoutes.get(
  "/summary",
  requireAuth,
  authorizeRoles("admin"),
  logisticsController.summary,
);

logisticsRoutes.get(
  "/fechamentos",
  requireAuth,
  authorizeRoles("admin"),
  logisticsController.listFechamentos,
);

logisticsRoutes.post(
  "/fechamentos",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(createFechamentoSchema),
  logisticsController.createFechamento,
);

export { logisticsRoutes };
