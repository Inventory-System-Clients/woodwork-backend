import { Router } from "express";
import { stockController } from "../controllers/stock.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createStockMovementSchema } from "../models/stock.model";

const stockRoutes = Router();

stockRoutes.use(requireAuth);
stockRoutes.use(authorizeRoles("admin", "gerente"));

stockRoutes.get("/movements", stockController.listMovements);
stockRoutes.post("/movements", validateBody(createStockMovementSchema), stockController.createMovement);

export { stockRoutes };
