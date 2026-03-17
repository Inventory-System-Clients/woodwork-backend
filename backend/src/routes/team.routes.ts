import { Router } from "express";
import { teamController } from "../controllers/team.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createTeamSchema, setTeamMembersSchema, updateTeamSchema } from "../models/team.model";

const teamRoutes = Router();

teamRoutes.use(requireAuth);
teamRoutes.use(authorizeRoles("admin", "gerente"));

teamRoutes.get("/", teamController.list);
teamRoutes.get("/:id", teamController.getById);
teamRoutes.post("/", validateBody(createTeamSchema), teamController.create);
teamRoutes.patch("/:id", validateBody(updateTeamSchema), teamController.update);
teamRoutes.put("/:id/members", validateBody(setTeamMembersSchema), teamController.setMembers);
teamRoutes.delete("/:id", teamController.remove);

export { teamRoutes };
