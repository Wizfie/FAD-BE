import express from "express";
import { LogController } from "../controllers/logController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// All log routes require admin access
router.use(authenticate);
router.use(authorize(["ADMIN"]));

// GET /api/logs/files - Get list of available log files
router.get("/files", LogController.getLogFiles);

// GET /api/logs/security - Get security logs with filtering
router.get("/security", LogController.getSecurityLogs);

// GET /api/logs/audit - Get audit logs with filtering
router.get("/audit", LogController.getAuditLogs);

// GET /api/logs/stats - Get log statistics
router.get("/stats", LogController.getLogStats);

// GET /api/logs/security/export - Export security logs as CSV
router.get("/security/export", LogController.exportSecurityLogs);

// GET /api/logs/audit/export - Export audit logs as CSV
router.get("/audit/export", LogController.exportAuditLogs);

// DELETE /api/logs/cleanup - Clear old logs
router.delete("/cleanup", LogController.clearOldLogs);

// POST /api/logs/simulate-threat - Simulate security threats for testing
router.post("/simulate-threat", LogController.simulateThreat);

export default router;
