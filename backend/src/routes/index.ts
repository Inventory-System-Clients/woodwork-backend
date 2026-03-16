import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { userRoutes } from "./user.routes";

const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/users", userRoutes);

export { apiRoutes };