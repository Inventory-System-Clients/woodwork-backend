import { Request, Response } from "express";
import { productService } from "../services/product.service";
import { asyncHandler } from "../utils/async-handler";

function toOptionalQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const list = asyncHandler(async (req: Request, res: Response) => {
  const search = toOptionalQueryString(req.query.search);
  const products = await productService.listProducts(search);
  res.status(200).json({ data: products });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  res.status(200).json({ data: product });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ data: product });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.status(200).json({ data: product });
});

export const productController = {
  list,
  getById,
  create,
  update,
};
