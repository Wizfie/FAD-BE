import express from "express";
import {
  saveDataHandler,
  getDataHandler,
  updateDataHandler,
  deleteDataHandler,
  saveControllerVendor,
  updateControllerVendor,
  getControllerVendor,
  deleteControllerVendor,
} from "../controllers/dataController.js";
import { exportFadHandler } from "../controllers/dataController.js";
import { getChangeLogs } from "../controllers/changeLogController.js";

import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { requireModule, requireAdmin } from "../middlewares/permission.js";
import { MODULES } from "../config/modules.js";

const router = express.Router();

// Routes Data FAD - View access
router.get(
  "/v1/get-fad",
  authenticate,
  requireModule(MODULES.FAD),
  getDataHandler
);

// Routes Data FAD - Admin only
router.post(
  "/v1/save-fad",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  saveDataHandler
);
router.put(
  "/v1/update-fad/:id",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  updateDataHandler
);
router.delete(
  "/v1/delete-fad/:id",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  deleteDataHandler
);

// Router Vendor - Admin only
router.get(
  "/v1/get-vendor",
  authenticate,
  requireModule(MODULES.FAD),
  getControllerVendor
);
router.post(
  "/v1/save-vendor",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  saveControllerVendor
);
router.put(
  "/v1/update-vendor/:id",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  updateControllerVendor
);
router.delete(
  "/v1/delete-vendor/:id",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  deleteControllerVendor
);

// Export FAD CSV - Admin only
router.get(
  "/v1/export-fad",
  authenticate,
  requireModule(MODULES.FAD),
  requireAdmin,
  exportFadHandler
);

// Get changelog for FAD module (last update feature)
router.get(
  "/getChangeLog",
  authenticate,
  requireModule(MODULES.FAD),
  getChangeLogs
);

export default router;
