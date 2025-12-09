import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LOG_DIR = process.env.LOG_DIR || "./logs";
const NODE_ENV = process.env.NODE_ENV || "development";

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Unified Logger - Single source of truth untuk semua logging
 * - Audit logs → Database (AuditLog table)
 * - Application logs → Files (app-YYYY-MM-DD.log)
 */
export class Logger {
  // ========================================
  // AUDIT LOGGING (Database)
  // ========================================

  /**
   * Log CREATE operation
   * @param {string} entity - Entity type (FAD, PHOTO, USER, etc)
   * @param {string} entityId - ID of created record
   * @param {object} data - Created data (key fields only)
   * @param {object} user - User object {id, username} or null
   */
  static async auditCreate(entity, entityId, data, user = null) {
    try {
      await prisma.auditLog.create({
        data: {
          entity: String(entity),
          entityId: entityId ? String(entityId) : null,
          operation: "CREATE",
          userId: user?.id || null,
          username: user?.username || null,
          changes: data || {},
        },
      });

      if (NODE_ENV === "development") {
        console.log(
          `✅ [AUDIT] CREATE ${entity}:${entityId} by ${
            user?.username || "system"
          }`
        );
      }
    } catch (error) {
      console.error("❌ Failed to log audit CREATE:", error.message);
    }
  }

  /**
   * Log UPDATE operation
   * @param {string} entity - Entity type
   * @param {string} entityId - ID of updated record
   * @param {object} changes - Object with {old, new} values for changed fields
   * @param {object} user - User object
   */
  static async auditUpdate(entity, entityId, changes, user = null) {
    try {
      await prisma.auditLog.create({
        data: {
          entity: String(entity),
          entityId: entityId ? String(entityId) : null,
          operation: "UPDATE",
          userId: user?.id || null,
          username: user?.username || null,
          changes: changes || {},
        },
      });

      if (NODE_ENV === "development") {
        console.log(
          `✏️ [AUDIT] UPDATE ${entity}:${entityId} by ${
            user?.username || "system"
          }`
        );
      }
    } catch (error) {
      console.error("❌ Failed to log audit UPDATE:", error.message);
    }
  }

  /**
   * Log DELETE operation
   * @param {string} entity - Entity type
   * @param {string} entityId - ID of deleted record
   * @param {object} data - Deleted record data (for reference)
   * @param {object} user - User object
   */
  static async auditDelete(entity, entityId, data, user = null) {
    try {
      await prisma.auditLog.create({
        data: {
          entity: String(entity),
          entityId: entityId ? String(entityId) : null,
          operation: "DELETE",
          userId: user?.id || null,
          username: user?.username || null,
          changes: data || {},
        },
      });

      if (NODE_ENV === "development") {
        console.log(
          `🗑️ [AUDIT] DELETE ${entity}:${entityId} by ${
            user?.username || "system"
          }`
        );
      }
    } catch (error) {
      console.error("❌ Failed to log audit DELETE:", error.message);
    }
  }

  // ========================================
  // SECURITY LOGGING (Database via AuditLog)
  // ========================================

  /**
   * Log authentication events
   * @param {string} operation - LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, etc
   * @param {string} username - Username attempting action
   * @param {object} details - Additional details (ip, reason, etc)
   * @param {string} userId - User ID if available
   */
  static async auditAuth(operation, username, details = {}, userId = null) {
    try {
      await prisma.auditLog.create({
        data: {
          entity: "AUTH",
          entityId: null,
          operation: String(operation),
          userId: userId || null,
          username: username || null,
          changes: details,
        },
      });

      if (NODE_ENV === "development") {
        const emoji = operation.includes("FAILED") ? "❌" : "✅";
        console.log(`${emoji} [AUTH] ${operation} - ${username}`);
      }
    } catch (error) {
      console.error("❌ Failed to log auth event:", error.message);
    }
  }

  /**
   * Log security events (unauthorized access, suspicious activity)
   */
  static async auditSecurity(event, details = {}, user = null) {
    try {
      await prisma.auditLog.create({
        data: {
          entity: "AUTH",
          entityId: null,
          operation: String(event),
          userId: user?.id || null,
          username: user?.username || null,
          changes: details,
        },
      });

      if (NODE_ENV === "development") {
        console.log(`🚨 [SECURITY] ${event} - ${user?.username || "unknown"}`);
      }
    } catch (error) {
      console.error("❌ Failed to log security event:", error.message);
    }
  }

  // ========================================
  // APPLICATION LOGGING (Files)
  // ========================================

  static _getLogFileName() {
    const today = new Date().toISOString().split("T")[0];
    return path.join(LOG_DIR, `app-${today}.log`);
  }

  static _formatLogEntry(level, message, context = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      pid: process.pid,
    });
  }

  static _writeToFile(level, message, context = {}) {
    try {
      const logFile = this._getLogFileName();
      const entry = this._formatLogEntry(level, message, context);
      fs.appendFileSync(logFile, entry + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error.message);
    }
  }

  /**
   * Log ERROR - Application errors
   */
  static error(message, context = {}) {
    this._writeToFile("ERROR", message, context);
    if (NODE_ENV === "development") {
      console.error(`❌ [ERROR] ${message}`, context);
    }
  }

  /**
   * Log WARNING
   */
  static warn(message, context = {}) {
    this._writeToFile("WARN", message, context);
    if (NODE_ENV === "development") {
      console.warn(`⚠️ [WARN] ${message}`, context);
    }
  }

  /**
   * Log INFO
   */
  static info(message, context = {}) {
    this._writeToFile("INFO", message, context);
    if (NODE_ENV === "development") {
      console.log(`ℹ️ [INFO] ${message}`, context);
    }
  }

  /**
   * Log DEBUG
   */
  static debug(message, context = {}) {
    if (NODE_ENV === "development") {
      this._writeToFile("DEBUG", message, context);
      console.log(`🐛 [DEBUG] ${message}`, context);
    }
  }

  // ========================================
  // CONVENIENCE METHODS
  // ========================================

  /**
   * Log HTTP request (file only, not DB)
   */
  static request(req, message = "Request received") {
    this.info(message, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
      username: req.user?.username,
    });
  }

  /**
   * Log validation error (file only)
   */
  static validation(field, value, reason) {
    this.warn("Validation failed", { field, value, reason });
  }

  // ========================================
  // BACKWARD COMPATIBILITY ALIASES
  // ========================================

  /**
   * Alias for auditSecurity - for suspicious activity
   */
  static async suspiciousActivity(event, details = {}, req = null) {
    const ip = req?.ip || details.ip || "unknown";
    const userAgent =
      req?.headers?.["user-agent"] || details.userAgent || "unknown";

    await this.auditSecurity(
      event,
      {
        ...details,
        ip,
        userAgent,
      },
      req?.user
    );
  }

  /**
   * Alias for auditSecurity - unauthorized access
   */
  static async unauthorizedAccess(endpoint, user, ip) {
    await this.auditSecurity(
      "UNAUTHORIZED_ACCESS",
      {
        endpoint,
        ip,
        userId: user?.id,
        userRole: user?.role,
      },
      user
    );
  }

  /**
   * Alias for auditAuth - auth failure
   */
  static async authFailure(username, ip, reason) {
    await this.auditAuth("LOGIN_FAILED", username, { ip, reason });
  }

  // ========================================
  // QUERY HELPERS
  // ========================================

  /**
   * Get audit logs with filters
   * @param {object} filters - {entity, operation, userId, startDate, endDate}
   * @param {number} limit - Max records to return
   */
  static async getAuditLogs(filters = {}, limit = 100) {
    const where = {};

    if (filters.entity) where.entity = filters.entity;
    if (filters.operation) where.operation = filters.operation;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get entity history (all changes for specific record)
   */
  static async getEntityHistory(entity, entityId) {
    return await prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get user activity
   */
  static async getUserActivity(userId, limit = 50) {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

// Export untuk backward compatibility
export const logger = Logger;
export default Logger;
