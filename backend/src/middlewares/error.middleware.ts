import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";

function sanitizePath(path: string): string {
  return path
    .replace(/(\/api\/public\/productions\/)[^/?#]+/i, "$1[token]")
    .replace(/(\/api\/productions\/public\/)[^/?#]+/i, "$1[token]")
    .replace(/(\/api\/productions\/shared\/)[^/?#]+/i, "$1[token]");
}

function toErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const route = sanitizePath(req.originalUrl || req.url);

  if (error instanceof ZodError) {
    console.warn("[error-middleware][validation]", {
      method: req.method,
      route,
      issues: error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    });

    res.status(400).json({
      message: "Validation error",
      errors: error.flatten(),
    });
    return;
  }

  if (error instanceof MulterError) {
    console.warn("[error-middleware][multer]", {
      method: req.method,
      route,
      code: error.code,
      message: error.message,
    });

    res.status(400).json({
      message: "Invalid upload request",
      details: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    const logPayload = {
      method: req.method,
      route,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details ?? null,
    };

    if (error.statusCode >= 500) {
      console.error("[error-middleware][app-error]", logPayload);
    } else {
      console.warn("[error-middleware][app-error]", logPayload);
    }

    res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
    return;
  }

  console.error("[error-middleware][unhandled]", {
    method: req.method,
    route,
    ...toErrorLog(error),
  });
  res.status(500).json({ message: "Internal server error" });
}