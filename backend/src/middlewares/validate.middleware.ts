import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects, ZodTypeAny } from "zod";

type BodySchema = AnyZodObject | ZodEffects<AnyZodObject> | ZodTypeAny;

export function validateBody(schema: BodySchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}