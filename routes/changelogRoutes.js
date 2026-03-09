import express from "express";
import {
  getChangeLogs,
  getChangeLogStats,
  getAuditLogSummary,
  exportAuditLogs,
} from "../controllers/changeLogController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import { requireSuperAdmin } from "../middlewares/permission.js";

const router = express.Router();

// Get changelog with filtering and pagination (Super Admin only)
router.get("/logs", authenticate, requireSuperAdmin, getChangeLogs);

// Get changelog statistics (Super Admin only)
router.get("/stats", authenticate, requireSuperAdmin, getChangeLogStats);

// Get audit log summary for dashboard (Super Admin only)
router.get("/summary", authenticate, requireSuperAdmin, getAuditLogSummary);

// Export audit logs as CSV (Super Admin only)
router.get("/export", authenticate, requireSuperAdmin, exportAuditLogs);

export default router;
