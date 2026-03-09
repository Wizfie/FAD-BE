import express from "express";
import { AreaController } from "../controllers/areaController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import { requireModule, requireAdmin } from "../middlewares/permission.js";
import { MODULES } from "../config/modules.js";

const router = express.Router();

// View access
router.get(
  "/areas",
  authenticate,
  requireModule(MODULES.TPS),
  AreaController.list
);

// Admin only
router.post(
  "/areas",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  AreaController.create
);
router.put(
  "/areas/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  AreaController.update
);
router.delete(
  "/areas/:id",
  authenticate,
  requireModule(MODULES.TPS),
  requireAdmin,
  AreaController.delete
);

export default router;
