import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { budgetRoutes } from "./budget.routes";
import { clientRoutes } from "./client.routes";
import { employeeRoutes } from "./employee.routes";
import { healthRoutes } from "./health.routes";
import { logisticsRoutes } from "./logistics.routes";
import { productRoutes } from "./product.routes";
import { productionRoutes } from "./production.routes";
import { publicRoutes } from "./public.routes";
import { stockRoutes } from "./stock.routes";
import { teamRoutes } from "./team.routes";
import { userRoutes } from "./user.routes";

const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/clients", clientRoutes);
apiRoutes.use("/logistics", logisticsRoutes);
apiRoutes.use("/budgets", budgetRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/stock", stockRoutes);
apiRoutes.use("/productions", productionRoutes);
apiRoutes.use("/public", publicRoutes);
apiRoutes.use("/employees", employeeRoutes);
apiRoutes.use("/teams", teamRoutes);
apiRoutes.use("/users", userRoutes);

export { apiRoutes };