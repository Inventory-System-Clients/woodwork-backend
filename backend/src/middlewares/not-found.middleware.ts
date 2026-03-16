import { NextFunction, Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}