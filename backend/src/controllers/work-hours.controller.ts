import { Request, Response } from "express";
import { listWorkHoursQuerySchema, workHoursDateSchema } from "../models/work-hours.model";
import { workHoursService } from "../services/work-hours.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

function requireAuthUserId(req: Request): string {
  if (!req.authUser) {
    throw new AppError("Unauthorized", 401);
  }

  return req.authUser.id;
}

const getMyDay = asyncHandler(async (req: Request, res: Response) => {
  const date =
    typeof req.query.date === "string" ? workHoursDateSchema.parse(req.query.date) : undefined;

  const result = await workHoursService.getDay(requireAuthUserId(req), date);
  res.status(200).json({ data: result });
});

const setMyDay = asyncHandler(async (req: Request, res: Response) => {
  const result = await workHoursService.setDay(requireAuthUserId(req), req.body);
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

const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = listWorkHoursQuerySchema.parse({
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  });

  const summary = await workHoursService.getSummary(query);
  res.status(200).json({ data: summary });
});

export const workHoursController = {
  getSummary,
  getMyDay,
  setMyDay,
  getEmployeeReport,
};
