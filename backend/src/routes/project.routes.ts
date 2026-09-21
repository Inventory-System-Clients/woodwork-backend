import { Router } from "express";
import { projectController } from "../controllers/project.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import {
  createProjectCostSchema,
  createProjectSchema,
  payProjectCostSchema,
  updateProjectSchema,
} from "../models/project.model";

const projectRoutes = Router();

projectRoutes.use(requireAuth);

// Employees get the names of active projects only (to pick where hours were logged).
projectRoutes.get("/", projectController.list);

projectRoutes.use(authorizeRoles("admin"));

projectRoutes.get("/dashboard", projectController.dashboard);
projectRoutes.post("/", validateBody(createProjectSchema), projectController.create);
projectRoutes.get("/:id", projectController.getById);
projectRoutes.patch("/:id", validateBody(updateProjectSchema), projectController.update);
projectRoutes.delete("/:id", projectController.remove);
projectRoutes.post("/:id/costs", validateBody(createProjectCostSchema), projectController.addCost);
projectRoutes.patch(
  "/:id/costs/:costId/pay",
  validateBody(payProjectCostSchema),
  projectController.markCostPaid,
);
projectRoutes.patch("/:id/costs/:costId/unpay", projectController.markCostUnpaid);
projectRoutes.delete("/:id/costs/:costId", projectController.removeCost);

export { projectRoutes };
