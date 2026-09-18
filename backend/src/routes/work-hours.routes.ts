import { Router } from "express";
import { workHoursController } from "../controllers/work-hours.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { setDayWorkHoursSchema } from "../models/work-hours.model";

const workHoursRoutes = Router();

workHoursRoutes.use(requireAuth);

// Optional ?date=YYYY-MM-DD (today or yesterday); defaults to today.
workHoursRoutes.get("/me", workHoursController.getMyDay);
workHoursRoutes.put("/me", validateBody(setDayWorkHoursSchema), workHoursController.setMyDay);

export { workHoursRoutes };
