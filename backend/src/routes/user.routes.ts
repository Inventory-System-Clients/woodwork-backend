import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createUserSchema, updateUserSchema } from "../models/user.model";

const userRoutes = Router();

userRoutes.use(requireAuth);
userRoutes.use(authorizeRoles("admin", "gerente"));

userRoutes.get("/", userController.list);
userRoutes.get("/:id", userController.getById);
userRoutes.post("/", validateBody(createUserSchema), userController.create);
userRoutes.patch("/:id", validateBody(updateUserSchema), userController.update);
userRoutes.delete("/:id", userController.remove);

export { userRoutes };