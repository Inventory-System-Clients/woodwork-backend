import { Request, Response } from "express";
import { listStockMovementsQuerySchema } from "../models/stock.model";
import { stockService } from "../services/stock.service";
import { asyncHandler } from "../utils/async-handler";

function toOptionalQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const query = listStockMovementsQuerySchema.parse({
    productId: toOptionalQueryString(req.query.productId),
    movementType: toOptionalQueryString(req.query.movementType),
    referenceType: toOptionalQueryString(req.query.referenceType),
    activeOnly: toOptionalQueryString(req.query.activeOnly),
    startDate: toOptionalQueryString(req.query.startDate),
    endDate: toOptionalQueryString(req.query.endDate),
    limit: toOptionalQueryString(req.query.limit),
    offset: toOptionalQueryString(req.query.offset),
  });

  const movements = await stockService.listStockMovements(query);

  res.status(200).json({
    data: movements.items,
    meta: {
      total: movements.total,
      limit: movements.limit,
      offset: movements.offset,
    },
  });
});

const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const movement = await stockService.createStockMovement(req.body);
  res.status(201).json({ data: movement });
});

export const stockController = {
  listMovements,
  createMovement,
};
