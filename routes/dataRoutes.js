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
import { exportChangeLogs } from "../controllers/changeLogController.js";

import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Routes Data FAD
router.post(
  "/v1/save-fad",
  authenticate,
  authorize(["ADMIN"]),
  saveDataHandler
);
router.get("/v1/get-fad", getDataHandler);
router.put(
  "/v1/update-fad/:id",
  authenticate,
  authorize(["ADMIN"]),
  updateDataHandler
);
router.delete(
  "/v1/delete-fad/:id",
  authenticate,
  authorize(["ADMIN"]),
  deleteDataHandler
);

// Router Vendor
router.post(
  "/v1/save-vendor",
  authenticate,
  authorize(["ADMIN"]),
  saveControllerVendor
);
router.put(
  "/v1/update-vendor/:id",
  authenticate,
  authorize(["ADMIN"]),
  updateControllerVendor
);
router.get(
  "/v1/get-vendor",
  authenticate,
  authorize(["ADMIN"]),
  getControllerVendor
);
router.delete(
  "/v1/delete-vendor/:id",
  authenticate,
  authorize(["ADMIN"]),
  deleteControllerVendor
);

// Export FAD CSV
router.get(
  "/v1/export-fad",
  authenticate,
  authorize(["ADMIN"]),
  exportFadHandler
);

// Log
router.get("/getChangeLog", getChangeLogs);
router.get(
  "/getChangeLog/export",
  authenticate,
  authorize(["ADMIN"]),
  exportChangeLogs
);

export default router;
