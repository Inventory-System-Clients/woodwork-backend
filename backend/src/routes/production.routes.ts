import { Router } from "express";
import multer from "multer";
import { productionController } from "../controllers/production.controller";
import { productionShareController } from "../controllers/production-share.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/authorize.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import {
  advanceProductionStatusSchema,
  createProductionSchema,
  productionExpenseSchema,
  setProductionMaterialsSchema,
  setProductionStatusesSchema,
  updateProductionExpenseSchema,
  updateProductionSchema,
} from "../models/production.model";
import { AppError } from "../utils/app-error";

const productionRoutes = Router();
const productionImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new AppError("Only image files are allowed", 400));
      return;
    }

    callback(null, true);
  },
});

productionRoutes.get("/", requireAuth, productionController.list);
productionRoutes.get(
  "/status-options",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  productionController.listStatusOptions,
);
productionRoutes.get(
  "/statuses/options",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  productionController.listStatusOptions,
);
productionRoutes.get(
  "/stages/options",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  productionController.listStatusOptions,
);
productionRoutes.post(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(createProductionSchema),
  productionController.create,
);
productionRoutes.patch(
  "/:id/advance-status",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  validateBody(advanceProductionStatusSchema),
  productionController.advanceStatus,
);
productionRoutes.put(
  "/:id/statuses",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(setProductionStatusesSchema),
  productionController.setStatuses,
);
productionRoutes.patch(
  "/:id/statuses",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(setProductionStatusesSchema),
  productionController.setStatuses,
);
productionRoutes.post(
  "/:id/statuses",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(setProductionStatusesSchema),
  productionController.setStatuses,
);
productionRoutes.patch(
  "/:id/complete",
  requireAuth,
  authorizeRoles("admin"),
  productionController.complete,
);
productionRoutes.patch(
  "/:id/approve",
  requireAuth,
  authorizeRoles("admin"),
  productionController.complete,
);
productionRoutes.get(
  "/:id/expenses",
  requireAuth,
  authorizeRoles("admin"),
  productionController.listExpenses,
);
productionRoutes.post(
  "/:id/expenses",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(productionExpenseSchema),
  productionController.addExpense,
);
productionRoutes.patch(
  "/:id/expenses/:expenseId",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(updateProductionExpenseSchema),
  productionController.updateExpense,
);
productionRoutes.patch(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(updateProductionSchema),
  productionController.update,
);
productionRoutes.put(
  "/:id/materials",
  requireAuth,
  authorizeRoles("admin"),
  validateBody(setProductionMaterialsSchema),
  productionController.setMaterials,
);
productionRoutes.delete(
  "/:id/expenses/:expenseId",
  requireAuth,
  authorizeRoles("admin"),
  productionController.deleteExpense,
);
productionRoutes.get(
  "/:id/cost-report",
  requireAuth,
  authorizeRoles("admin"),
  productionController.getCostReport,
);
productionRoutes.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  productionController.remove,
);
productionRoutes.post(
  "/:id/share-link",
  requireAuth,
  authorizeRoles("admin"),
  productionShareController.createShareLink,
);
productionRoutes.post(
  "/:id/share",
  requireAuth,
  authorizeRoles("admin"),
  productionShareController.createShareLink,
);
productionRoutes.get(
  "/:id/images",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  productionShareController.listImages,
);
productionRoutes.post(
  "/:id/images",
  requireAuth,
  authorizeRoles("admin", "funcionario"),
  productionImagesUpload.array("images", 10),
  productionShareController.uploadImages,
);
productionRoutes.get("/public/:token", productionShareController.getPublicProductionByToken);
productionRoutes.get("/shared/:token", productionShareController.getPublicProductionByToken);
productionRoutes.get(
  "/public/:token/images/:imageId",
  productionShareController.getPublicProductionImageByToken,
);
productionRoutes.get(
  "/shared/:token/images/:imageId",
  productionShareController.getPublicProductionImageByToken,
);

export { productionRoutes };
