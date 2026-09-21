import { Router } from "express";
import { workHoursController } from "../controllers/work-hours.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { setDayWorkHoursSchema } from "../models/work-hours.model";

const workHoursRoutes = Router();

workHoursRoutes.use(requireAuth);

// Optional ?date=YYYY-MM-DD (today or yesterday); defaults to today.
workHoursRoutes.get("/me", workHoursController.getMyDay);
workHoursRoutes.put("/me", validateBody(setDayWorkHoursSchema), workHoursController.setMyDay);

// Administrative view: hours summed per employee and project/activity (?from&to, default: current month).
workHoursRoutes.get("/summary", authorizeRoles("admin"), workHoursController.getSummary);

export { workHoursRoutes };
