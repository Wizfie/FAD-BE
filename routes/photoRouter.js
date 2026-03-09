import { PhotoController } from "../controllers/photoController.js";
import { Router } from "express";
import { upload } from "../config/multer.js";
import { multerErrorHandler } from "../middlewares/multerErrorHandler.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import { requireModule, requireAdmin } from "../middlewares/permission.js";
import { MODULES } from "../config/modules.js";

const router = Router();

// View access
router.get(
  "/photos",
  authenticate,
  requireModule(MODULES.TPS),
  PhotoController.list
);
router.get(
  "/comparison-groups",
  authenticate,
  requireModule(MODULES.TPS),
  PhotoController.listGroups
);
router.get(
  "/comparison-groups/:id",
  authenticate,
  requireModule(MODULES.TPS),
  PhotoController.getGroup
);

// Admin only
router.post(
  "/photos",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  upload.array("files", 3),
  multerErrorHandler,
  PhotoController.upload
);
router.put(
  "/photos/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  PhotoController.update
);
router.delete(
  "/photos/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  PhotoController.remove
);

router.post(
  "/comparison-groups",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  PhotoController.createGroup
);
router.put(
  "/comparison-groups/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  PhotoController.updateGroup
);
router.delete(
  "/comparison-groups/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  PhotoController.deleteGroup
);

export default router;
