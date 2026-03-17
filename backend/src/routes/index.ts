import { Router } from "express";
import { employeeRoutes } from "./employee.routes";
import { healthRoutes } from "./health.routes";
import { productionRoutes } from "./production.routes";
import { teamRoutes } from "./team.routes";
import { userRoutes } from "./user.routes";

const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/productions", productionRoutes);
apiRoutes.use("/employees", employeeRoutes);
apiRoutes.use("/teams", teamRoutes);
apiRoutes.use("/users", userRoutes);

export { apiRoutes };