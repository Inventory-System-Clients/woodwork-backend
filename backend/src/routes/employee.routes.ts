import { Router } from "express";
import { employeeController } from "../controllers/employee.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { createEmployeeSchema, updateEmployeeSchema } from "../models/employee.model";

const employeeRoutes = Router();

employeeRoutes.get("/", employeeController.list);
employeeRoutes.get("/:id", employeeController.getById);
employeeRoutes.post("/", validateBody(createEmployeeSchema), employeeController.create);
employeeRoutes.patch("/:id", validateBody(updateEmployeeSchema), employeeController.update);
employeeRoutes.delete("/:id", employeeController.remove);

export { employeeRoutes };
