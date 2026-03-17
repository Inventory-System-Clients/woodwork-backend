import { Router } from "express";
import { logisticsController } from "../controllers/logistics.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";

const logisticsRoutes = Router();

logisticsRoutes.get(
  "/summary",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  logisticsController.summary,
);

export { logisticsRoutes };
