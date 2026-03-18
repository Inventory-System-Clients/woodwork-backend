import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createProductSchema, updateProductSchema } from "../models/product.model";

const productRoutes = Router();

productRoutes.use(requireAuth);
productRoutes.use(authorizeRoles("admin", "gerente"));

productRoutes.get("/", productController.list);
productRoutes.get("/:id", productController.getById);
productRoutes.post("/", validateBody(createProductSchema), productController.create);
productRoutes.patch("/:id", validateBody(updateProductSchema), productController.update);

export { productRoutes };
