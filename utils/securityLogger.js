import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "./logs";

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const securityLogger = {
  logSuspiciousActivity: (event, details, req = null) => {
    const timestamp = new Date().toISOString();
    const ip = req ? req.ip || req.connection.remoteAddress : "unknown";
    const userAgent = req ? req.get("user-agent") : "unknown";

    const logEntry = {
      timestamp,
      event,
      ip,
      userAgent,
      details,
    };

    const logFile = path.join(
      LOG_DIR,
      `security-${new Date().toISOString().split("T")[0]}.log`
    );
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");

    // Also log to console in development
    if (process.env.NODE_ENV === "development") {
      console.warn(`🚨 Security Event: ${event}`, logEntry);
    }
  },

  logAuthFailure: (username, ip, reason) => {
    securityLogger.logSuspiciousActivity(
      "AUTH_FAILURE",
      {
        username,
        reason,
        severity: "high",
      },
      { ip }
    );
  },

  logUnauthorizedAccess: (endpoint, user, ip) => {
    securityLogger.logSuspiciousActivity(
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
  },
};
