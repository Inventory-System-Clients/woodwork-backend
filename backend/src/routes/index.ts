import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { budgetRoutes } from "./budget.routes";
import { employeeRoutes } from "./employee.routes";
import { healthRoutes } from "./health.routes";
import { logisticsRoutes } from "./logistics.routes";
import { productionRoutes } from "./production.routes";
import { teamRoutes } from "./team.routes";
import { userRoutes } from "./user.routes";

const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/logistics", logisticsRoutes);
apiRoutes.use("/budgets", budgetRoutes);
apiRoutes.use("/productions", productionRoutes);
apiRoutes.use("/employees", employeeRoutes);
apiRoutes.use("/teams", teamRoutes);
apiRoutes.use("/users", userRoutes);

export { apiRoutes };