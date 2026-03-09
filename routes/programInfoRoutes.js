/**
 * Program Info Routes - API endpoints untuk gambar Program 5R
 */
import express from "express";
import { upload } from "../config/multer.js";
import { ProgramInfoController } from "../controllers/ProgramInfoController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import { requireModule, requireAdmin } from "../middlewares/permission.js";
import { MODULES } from "../config/modules.js";

const router = express.Router();

// Get all program info images (TPS module required)
router.get(
  "/program-info",
  authenticate,
  requireModule(MODULES.TPS),
  ProgramInfoController.getAll
);

// Upload program info image (admin only)
router.post(
  "/program-info",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  upload.single("image"),
  ProgramInfoController.upload
);

// Delete program info image (admin only)
router.delete(
  "/program-info/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  ProgramInfoController.remove
);

// Update display order (admin only)
router.put(
  "/program-info/order",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  ProgramInfoController.updateOrder
);

// Reorder single image (admin only)
router.patch(
  "/program-info/:id/reorder",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  ProgramInfoController.reorder
);

export default router;
