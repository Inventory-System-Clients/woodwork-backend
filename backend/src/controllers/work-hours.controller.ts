import { Request, Response } from "express";
import { listWorkHoursQuerySchema } from "../models/work-hours.model";
import { workHoursService } from "../services/work-hours.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

function requireAuthUserId(req: Request): string {
  if (!req.authUser) {
    throw new AppError("Unauthorized", 401);
  }

  return req.authUser.id;
}

const getMyToday = asyncHandler(async (req: Request, res: Response) => {
  const result = await workHoursService.getToday(requireAuthUserId(req));
  res.status(200).json({ data: result });
});

const setMyToday = asyncHandler(async (req: Request, res: Response) => {
  const result = await workHoursService.setToday(requireAuthUserId(req), req.body);
  res.status(200).json({ data: result });
});

const getEmployeeReport = asyncHandler(async (req: Request, res: Response) => {
  const query = listWorkHoursQuerySchema.parse({
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  });

  const report = await workHoursService.getReportForEmployee(req.params.id, query);
  res.status(200).json({ data: report });
});

export const workHoursController = {
  getMyToday,
  setMyToday,
  getEmployeeReport,
};
