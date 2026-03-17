import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema } from "../models/auth.model";

const authRoutes = Router();

authRoutes.post("/login", validateBody(loginSchema), authController.login);
authRoutes.get("/me", requireAuth, authController.me);

export { authRoutes };
