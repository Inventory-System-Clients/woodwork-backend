import { CreateProductInput, Product, UpdateProductInput } from "../models/product.model";
import { productRepository } from "../repositories/product.repository";
import { AppError } from "../utils/app-error";

async function ensureProductNameAvailable(name: string, excludedId?: string): Promise<void> {
  const existingProduct = await productRepository.findByName(name);

  if (existingProduct && existingProduct.id !== excludedId) {
    throw new AppError("Product name is already in use", 409);
  }
}

async function listProducts(search?: string): Promise<Product[]> {
  return productRepository.findAll(search);
}

async function getProductById(id: string): Promise<Product> {
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return product;
}

async function createProduct(payload: CreateProductInput): Promise<Product> {
  await ensureProductNameAvailable(payload.name);
  return productRepository.create(payload);
}

async function updateProduct(id: string, payload: UpdateProductInput): Promise<Product> {
  const existingProduct = await productRepository.findById(id);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  const nextName = payload.name ?? existingProduct.name;
  const nextLowStockAlertQuantity =
    payload.lowStockAlertQuantity ?? existingProduct.lowStockAlertQuantity;

  if (nextName !== existingProduct.name) {
    await ensureProductNameAvailable(nextName, id);
  }

  const updatedProduct = await productRepository.update(id, {
    name: nextName,
    lowStockAlertQuantity: nextLowStockAlertQuantity,
  });

  if (!updatedProduct) {
    throw new AppError("Product not found", 404);
  }

  return updatedProduct;
}

export const productService = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
};
