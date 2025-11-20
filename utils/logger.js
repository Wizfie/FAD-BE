import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "./logs";
const NODE_ENV = process.env.NODE_ENV || "development";

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Centralized Logger Utility
 * Replaces console.log with structured logging
 */
export class Logger {
  static LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static getCurrentLogLevel() {
    const level = process.env.LOG_LEVEL || "INFO";
    return this.LOG_LEVELS[level.toUpperCase()] || this.LOG_LEVELS.INFO;
  }

  static formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      context,
      pid: process.pid,
    };
  }

  static log(level, message, context = {}) {
    const currentLevel = this.getCurrentLogLevel();
    const messageLevel = this.LOG_LEVELS[level];

    if (messageLevel <= currentLevel) {
      const formatted = this.formatMessage(level, message, context);

      // Always log to console in development
      if (NODE_ENV === "development") {
        const emoji = {
          ERROR: "❌",
          WARN: "⚠️",
          INFO: "ℹ️",
          DEBUG: "🐛",
        };
        console.log(
          `${emoji[level]} [${formatted.timestamp}] ${message}`,
          context
        );
      }

      // Log to file in production
      if (NODE_ENV === "production") {
        const logFile = path.join(
          LOG_DIR,
          `app-${new Date().toISOString().split("T")[0]}.log`
        );
        fs.appendFileSync(logFile, JSON.stringify(formatted) + "\n");
      }
    }
  }

  static error(message, context = {}) {
    this.log("ERROR", message, context);
  }

  static warn(message, context = {}) {
    this.log("WARN", message, context);
  }

  static info(message, context = {}) {
    this.log("INFO", message, context);
  }

  static debug(message, context = {}) {
    this.log("DEBUG", message, context);
  }

  // Specific loggers for different operations
  static request(req, message = "Request received") {
    this.info(message, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.user?.id,
      username: req.user?.username,
    });
  }

  static operation(operation, entity, data = {}) {
    this.info(`${operation} operation completed`, {
      operation,
      entity,
      data,
    });
  }

  static validation(field, value, reason) {
    this.warn("Validation failed", {
      field,
      value,
      reason,
    });
  }

  static database(operation, table, data = {}) {
    this.debug(`Database ${operation}`, {
      operation,
      table,
      data,
    });
  }
}

// Export default instance for convenience
export const logger = Logger;
