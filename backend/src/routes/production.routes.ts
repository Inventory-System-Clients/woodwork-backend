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
  setProductionStatusesSchema,
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
  authorizeRoles("admin", "gerente"),
  productionController.listStatusOptions,
);
productionRoutes.post(
  "/",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  validateBody(createProductionSchema),
  productionController.create,
);
productionRoutes.patch(
  "/:id/advance-status",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  validateBody(advanceProductionStatusSchema),
  productionController.advanceStatus,
);
productionRoutes.put(
  "/:id/statuses",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  validateBody(setProductionStatusesSchema),
  productionController.setStatuses,
);
productionRoutes.patch(
  "/:id/complete",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.complete,
);
productionRoutes.patch(
  "/:id/approve",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionController.complete,
);
productionRoutes.post(
  "/:id/share-link",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionShareController.createShareLink,
);
productionRoutes.post(
  "/:id/share",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionShareController.createShareLink,
);
productionRoutes.get(
  "/:id/images",
  requireAuth,
  authorizeRoles("admin", "gerente"),
  productionShareController.listImages,
);
productionRoutes.post(
  "/:id/images",
  requireAuth,
  authorizeRoles("admin", "gerente"),
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
