import { Router } from "express";
import { budgetController } from "../controllers/budget.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createBudgetSchema, updateBudgetSchema } from "../models/budget.model";

const budgetRoutes = Router();

budgetRoutes.use(requireAuth);
budgetRoutes.use(authorizeRoles("admin", "gerente"));

budgetRoutes.get("/", budgetController.list);
budgetRoutes.get("/expense-departments", budgetController.listExpenseDepartments);
budgetRoutes.get("/:id", budgetController.getById);
budgetRoutes.post("/", validateBody(createBudgetSchema), budgetController.create);
budgetRoutes.patch("/:id", validateBody(updateBudgetSchema), budgetController.update);
budgetRoutes.patch("/:id/approve", budgetController.approve);

export { budgetRoutes };
