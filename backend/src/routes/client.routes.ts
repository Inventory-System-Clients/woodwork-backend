import { Router } from "express";
import { clientController } from "../controllers/client.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createClientSchema, updateClientSchema } from "../models/client.model";

const clientRoutes = Router();

clientRoutes.use(requireAuth);
clientRoutes.use(authorizeRoles("admin", "gerente"));

clientRoutes.get("/", clientController.list);
clientRoutes.get("/:id", clientController.getById);
clientRoutes.post("/", validateBody(createClientSchema), clientController.create);
clientRoutes.patch("/:id", validateBody(updateClientSchema), clientController.update);
clientRoutes.delete("/:id", clientController.remove);

export { clientRoutes };
