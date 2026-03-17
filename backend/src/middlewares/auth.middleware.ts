import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/app-error";

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [type, token] = headerValue.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError("Unauthorized", 401);
    }

    let decoded: JwtPayload | string;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }

    const userId = typeof decoded === "string" ? undefined : decoded.sub;

    if (!userId) {
      throw new AppError("Invalid token payload", 401);
    }

    const employee = await employeeRepository.findAuthById(userId);

    if (!employee || !employee.isActive) {
      throw new AppError("Unauthorized", 401);
    }

    req.authUser = {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
