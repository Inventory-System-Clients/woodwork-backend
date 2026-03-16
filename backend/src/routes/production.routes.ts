import { Router } from "express";
import { productionController } from "../controllers/production.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { createProductionSchema } from "../models/production.model";

const productionRoutes = Router();

productionRoutes.post("/", validateBody(createProductionSchema), productionController.create);
productionRoutes.get("/", productionController.list);
productionRoutes.patch("/:id/complete", productionController.complete);

export { productionRoutes };
