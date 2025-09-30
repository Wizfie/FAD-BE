import express from "express";
import {
  getChangeLogs,
  getChangeLogStats,
  exportChangeLogs,
} from "../controllers/changeLogController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Get changelog with filtering and pagination (Admin only)
router.get("/logs", authenticate, authorize(["ADMIN"]), getChangeLogs);

// Get changelog statistics (Admin only)
router.get("/stats", authenticate, authorize(["ADMIN"]), getChangeLogStats);

// Export changelog as CSV (Admin only)
router.get("/export", authenticate, authorize(["ADMIN"]), exportChangeLogs);

export default router;
