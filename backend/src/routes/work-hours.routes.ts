import { Router } from "express";
import { workHoursController } from "../controllers/work-hours.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { setTodayWorkHoursSchema } from "../models/work-hours.model";

const workHoursRoutes = Router();

workHoursRoutes.use(requireAuth);

workHoursRoutes.get("/me/today", workHoursController.getMyToday);
workHoursRoutes.put("/me/today", validateBody(setTodayWorkHoursSchema), workHoursController.setMyToday);

export { workHoursRoutes };
