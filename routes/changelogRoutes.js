import express from "express";
import {
  getChangeLogs,
  getChangeLogStats,
  getAuditLogSummary,
  exportAuditLogs,
} from "../controllers/changeLogController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Get changelog with filtering and pagination (Admin only)
router.get("/logs", authenticate, authorize(["ADMIN"]), getChangeLogs);

// Get changelog statistics (Admin only)
router.get("/stats", authenticate, authorize(["ADMIN"]), getChangeLogStats);

// Get audit log summary for dashboard (Admin only)
router.get("/summary", authenticate, authorize(["ADMIN"]), getAuditLogSummary);

// Export audit logs as CSV (Admin only)
router.get("/export", authenticate, authorize(["ADMIN"]), exportAuditLogs);

export default router;
