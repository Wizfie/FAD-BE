import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const LOG_DIR = process.env.LOG_DIR || "./logs";
const NODE_ENV = process.env.NODE_ENV || "development";
const prisma = new PrismaClient();

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Unified Logger - Menggabungkan changelog, securityLogger, dan logger
 * Single point untuk semua logging needs
 */
export class UnifiedLogger {
  static LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static LOG_TYPES = {
    APPLICATION: "app",
    SECURITY: "security",
    AUDIT: "audit",
  };

  static getCurrentLogLevel() {
    const level = process.env.LOG_LEVEL || "INFO";
    return this.LOG_LEVELS[level.toUpperCase()] || this.LOG_LEVELS.INFO;
  }

  static formatMessage(level, message, context = {}, type = "APPLICATION") {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      type,
      message,
      context,
      pid: process.pid,
    };
  }

  /**
   * Core logging method
   */
  static async log(
    level,
    message,
    context = {},
    type = "APPLICATION",
    saveToDb = false
  ) {
    const currentLevel = this.getCurrentLogLevel();
    const messageLevel = this.LOG_LEVELS[level];

    if (messageLevel <= currentLevel) {
      const formatted = this.formatMessage(level, message, context, type);

      // Console output in development
      if (NODE_ENV === "development") {
        const emoji = {
          ERROR: "❌",
          WARN: "⚠️",
          INFO: "ℹ️",
          DEBUG: "🐛",
        };
        const typeEmoji = {
          APPLICATION: "📱",
          SECURITY: "🔒",
          AUDIT: "📋",
        };
        console.log(
          `${emoji[level]} ${typeEmoji[type]} [${formatted.timestamp}] ${message}`,
          context
        );
      }

      // File logging
      const logFileName =
        type === "SECURITY" ? "security" : type === "AUDIT" ? "audit" : "app";
      const logFile = path.join(
        LOG_DIR,
        `${logFileName}-${new Date().toISOString().split("T")[0]}.log`
      );
      fs.appendFileSync(logFile, JSON.stringify(formatted) + "\n");

      // Database logging for audit trail (business operations)
      if (saveToDb && type === "AUDIT") {
        try {
          await prisma.changeLog.create({
            data: {
              model: context.entity || "SYSTEM",
              action: context.operation || "LOG",
              data: context,
            },
          });
        } catch (error) {
          // If DB logging fails, at least log to file
          this.error("Failed to save audit log to database", {
            error: error.message,
            originalContext: context,
          });
        }
      }
    }
  }

  // ========== BASIC LOGGING METHODS ==========
  static async error(message, context = {}) {
    await this.log("ERROR", message, context, "APPLICATION");
  }

  static async warn(message, context = {}) {
    await this.log("WARN", message, context, "APPLICATION");
  }

  static async info(message, context = {}) {
    await this.log("INFO", message, context, "APPLICATION");
  }

  static async debug(message, context = {}) {
    await this.log("DEBUG", message, context, "APPLICATION");
  }

  // ========== SECURITY LOGGING METHODS ==========
  static async security(event, details, req = null) {
    const ip = req
      ? req.ip || req.connection?.remoteAddress || "unknown"
      : "unknown";
    const userAgent = req
      ? typeof req.get === "function"
        ? req.get("user-agent")
        : "unknown"
      : "unknown";
    const userId = req?.user?.id;
    const username = req?.user?.username;

    const context = {
      event,
      ip,
      userAgent,
      userId,
      username,
      ...details,
    };

    await this.log("WARN", `Security Event: ${event}`, context, "SECURITY");
  }

  static async authFailure(username, ip, reason) {
    await this.security(
      "AUTH_FAILURE",
      {
        username,
        reason,
        severity: "high",
      },
      { ip }
    );
  }

  static async unauthorizedAccess(endpoint, user, ip) {
    await this.security(
      "UNAUTHORIZED_ACCESS",
      {
        endpoint,
        userId: user?.id,
        username: user?.username,
        userRole: user?.role,
        severity: "medium",
      },
      { ip }
    );
  }

  static async suspiciousActivity(event, details, req = null) {
    await this.security(event, details, req);
  }

  // ========== AUDIT/BUSINESS LOGGING METHODS ==========
  static async audit(
    operation,
    entity,
    data = {},
    userId = null,
    username = null
  ) {
    const context = {
      operation,
      entity,
      userId,
      username,
      ...data,
    };

    await this.log(
      "INFO",
      `${operation} operation on ${entity}`,
      context,
      "AUDIT",
      true
    );
  }

  // Helper method to clean and format data for changelog
  static formatChangelogData(data, operation = null) {
    if (!data || typeof data !== "object") return data;

    const cleaned = { ...data };

    // Remove redundant fields that are already in separate columns or not needed
    const fieldsToRemove = [
      "id", // Already have entity ID in separate column
      "operation", // Already have operation in separate column
      "createdAt",
      "updatedAt",
      "created_by",
      "updated_by",
      "vendorId", // Keep vendor name only, remove vendorId
    ];

    fieldsToRemove.forEach((field) => {
      if (cleaned[field]) delete cleaned[field];
    });

    // Clean nested vendor data to avoid redundancy
    if (cleaned.vendorRel) {
      // Keep only essential vendor info, remove redundant data
      cleaned.vendor = cleaned.vendorRel.name;
      delete cleaned.vendorRel;
    }

    // Format dates to readable format
    const dateFields = ["terimaFad", "terimaBbm", "bast", "deletedAt"];
    dateFields.forEach((field) => {
      if (cleaned[field]) {
        try {
          const date = new Date(cleaned[field]);
          cleaned[field] = date.toISOString().split("T")[0]; // YYYY-MM-DD format
        } catch (e) {
          // Keep original value if date parsing fails
        }
      }
    });

    return cleaned;
  }

  // Enhanced shorthand methods for common operations
  static async create(entity, data, user = null) {
    const cleanedData = this.formatChangelogData(data, "CREATE");
    const logData = {
      data: cleanedData,
    };

    await this.audit("CREATE", entity, logData, user?.id, user?.username);
  }

  static async update(entity, data, user = null) {
    const { afterData, changes } = data;

    // Clean the after data for better readability
    const cleanedData = afterData
      ? this.formatChangelogData(afterData, "UPDATE")
      : null;

    const logData = {
      data: cleanedData,
      changes: changes || {},
    };

    await this.audit("UPDATE", entity, logData, user?.id, user?.username);
  }

  static async delete(entity, data, user = null) {
    const cleanedData = this.formatChangelogData(
      data.beforeData || data,
      "DELETE"
    );
    const logData = {
      deletedData: cleanedData,
    };

    await this.audit("DELETE", entity, logData, user?.id, user?.username);
  }

  static async upload(entity, data, user = null) {
    await this.audit("UPLOAD", entity, data, user?.id, user?.username);
  }

  static async login(user, ip = null) {
    await this.audit(
      "LOGIN",
      "USER",
      {
        id: user.id,
        username: user.username,
        ip,
      },
      user.id,
      user.username
    );
  }

  static async register(user, ip = null) {
    await this.audit(
      "REGISTER",
      "USER",
      {
        id: user.id,
        username: user.username,
        role: user.role,
        ip,
      },
      user.id,
      user.username
    );
  }

  // ========== REQUEST LOGGING ==========
  static async request(req, message = "Request received") {
    await this.info(message, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.user?.id,
      username: req.user?.username,
    });
  }

  // ========== VALIDATION LOGGING ==========
  static async validation(field, value, reason) {
    await this.warn("Validation failed", {
      field,
      value,
      reason,
    });
  }

  // ========== DATABASE LOGGING ==========
  static async database(operation, table, data = {}) {
    await this.debug(`Database ${operation}`, {
      operation,
      table,
      data,
    });
  }

  // ========== LEGACY COMPATIBILITY ==========
  // Untuk backward compatibility dengan changeLog function
  static async changeLog(model, action, data) {
    await this.audit(action, model, data);
  }

  // Untuk backward compatibility dengan securityLogger
  static async logSuspiciousActivity(event, details, req = null) {
    await this.suspiciousActivity(event, details, req);
  }

  static async logAuthFailure(username, ip, reason) {
    await this.authFailure(username, ip, reason);
  }

  static async logUnauthorizedAccess(endpoint, user, ip) {
    await this.unauthorizedAccess(endpoint, user, ip);
  }
}

// Export default instance for convenience
export const logger = UnifiedLogger;

// Export individual methods for easier imports
export const {
  error,
  warn,
  info,
  debug,
  security,
  audit,
  create,
  update,
  delete: deleteLog,
  upload,
  login,
  register,
  request,
  validation,
  database,
  changeLog,
  authFailure,
  unauthorizedAccess,
  suspiciousActivity,
} = UnifiedLogger;
