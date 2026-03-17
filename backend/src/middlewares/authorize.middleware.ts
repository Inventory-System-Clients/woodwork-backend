import { NextFunction, Request, Response } from "express";
import { EmployeeRole } from "../models/employee.model";
import { AppError } from "../utils/app-error";

export function authorizeRoles(...allowedRoles: EmployeeRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;

    if (!role) {
      next(new AppError("Unauthorized", 401));
      return;
    }

    if (!allowedRoles.includes(role)) {
      next(new AppError("Forbidden", 403));
      return;
    }

    next();
  };
}
