import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "./logs";

export class LogController {
  /**
   * Dapatkan daftar file log yang tersedia
   */
  static async getLogFiles(req, res) {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        return res.json({ files: [] });
      }

      const files = fs
        .readdirSync(LOG_DIR)
        .filter((file) => file.endsWith(".log"))
        .map((file) => {
          const filePath = path.join(LOG_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));

      res.json({ files });
    } catch (error) {
      console.error("Error getting log files:", error);
      res.status(500).json({ error: "Failed to get log files" });
    }
  }

  /**
   * Ambil security logs dengan filter dan pagination
   */
  static async getSecurityLogs(req, res) {
    try {
      const {
        date = new Date().toISOString().split("T")[0],
        page = 1,
        limit = 50,
        event = "",
        severity = "",
        ip = "",
      } = req.query;

      const logFile = path.join(LOG_DIR, `security-${date}.log`);

      if (!fs.existsSync(logFile)) {
        return res.json({
          logs: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          message: `No security logs found for date: ${date}`,
        });
      }

      const logContent = fs.readFileSync(logFile, "utf8");
      const logLines = logContent
        .trim()
        .split("\n")
        .filter((line) => line);

      // Parse and filter logs
      let logs = logLines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((log) => log !== null);

      // Apply filters
      if (event) {
        logs = logs.filter((log) =>
          log.event.toLowerCase().includes(event.toLowerCase())
        );
      }
      if (severity && logs.length > 0) {
        logs = logs.filter((log) => log.details?.severity === severity);
      }
      if (ip) {
        logs = logs.filter((log) => log.ip && log.ip.includes(ip));
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Pagination
      const total = logs.length;
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedLogs = logs.slice(
        startIndex,
        startIndex + parseInt(limit)
      );

      res.json({
        logs: paginatedLogs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error reading security logs:", error);
      res.status(500).json({ error: "Failed to read security logs" });
    }
  }

  /**
   * Dapatkan statistik/ringkasan log
   */
  static async getLogStats(req, res) {
    try {
      const { days = 7 } = req.query;
      const stats = {
        totalEvents: 0,
        eventTypes: {},
        severityCount: { high: 0, medium: 0, low: 0 },
        ipAddresses: {},
        recentEvents: [],
      };

      // Get logs from last N days
      for (let i = 0; i < parseInt(days); i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const logFile = path.join(LOG_DIR, `security-${dateStr}.log`);

        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, "utf8");
          const logLines = logContent
            .trim()
            .split("\n")
            .filter((line) => line);

          logLines.forEach((line) => {
            try {
              const log = JSON.parse(line);
              stats.totalEvents++;

              // Count event types
              stats.eventTypes[log.event] =
                (stats.eventTypes[log.event] || 0) + 1;

              // Count severity
              if (log.details?.severity) {
                stats.severityCount[log.details.severity]++;
              }

              // Count IP addresses
              if (log.ip && log.ip !== "unknown") {
                stats.ipAddresses[log.ip] =
                  (stats.ipAddresses[log.ip] || 0) + 1;
              }

              // Collect recent events
              if (stats.recentEvents.length < 10) {
                stats.recentEvents.push(log);
              }
            } catch (e) {
              // Skip invalid log lines
            }
          });
        }
      }

      // Sort recent events by timestamp
      stats.recentEvents.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      res.json(stats);
    } catch (error) {
      console.error("Error getting log stats:", error);
      res.status(500).json({ error: "Failed to get log statistics" });
    }
  }

  /**
   * Hapus log lama (khusus admin)
   */
  static async clearOldLogs(req, res) {
    try {
      const { days = 30 } = req.body;
      let deletedFiles = 0;

      if (!fs.existsSync(LOG_DIR)) {
        return res.json({
          message: "No logs directory found",
          deletedFiles: 0,
        });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      const files = fs
        .readdirSync(LOG_DIR)
        .filter((file) => file.endsWith(".log"));

      files.forEach((file) => {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedFiles++;
        }
      });

      res.json({
        message: `Deleted ${deletedFiles} old log files older than ${days} days`,
        deletedFiles,
      });
    } catch (error) {
      console.error("Error clearing old logs:", error);
      res.status(500).json({ error: "Failed to clear old logs" });
    }
  }

  /**
   * Simulasi ancaman keamanan untuk testing
   */
  static async simulateThreat(req, res) {
    try {
      const { threatType = "random", count = 5 } = req.body;

      // Import securityLogger
      const { securityLogger } = await import("../utils/securityLogger.js");

      const threats = [];
      const threatTypes = [
        {
          event: "AUTH_FAILURE",
          details: {
            username: "admin",
            reason: "Invalid password",
            severity: "high",
            attempts: Math.floor(Math.random() * 5) + 1,
          },
        },
        {
          event: "UNAUTHORIZED_ACCESS",
          details: {
            endpoint: "/api/admin/users",
            username: "guest_user",
            severity: "medium",
            reason: "Insufficient privileges",
          },
        },
        {
          event: "SUSPICIOUS_ACTIVITY",
          details: {
            reason: "Multiple failed login attempts from same IP",
            severity: "high",
            pattern: "brute_force_attack",
          },
        },
        {
          event: "SUSPICIOUS_ACTIVITY",
          details: {
            reason: "SQL injection attempt detected",
            severity: "high",
            payload: "' OR 1=1 --",
            endpoint: "/api/data/fad",
          },
        },
        {
          event: "UNAUTHORIZED_ACCESS",
          details: {
            reason: "Access to sensitive endpoint without authorization",
            endpoint: "/api/admin/system",
            severity: "medium",
          },
        },
      ];

      // Generate fake IPs
      const generateFakeIP = () => {
        return `${Math.floor(Math.random() * 255)}.${Math.floor(
          Math.random() * 255
        )}.${Math.floor(Math.random() * 255)}.${Math.floor(
          Math.random() * 255
        )}`;
      };

      const generateFakeUserAgent = () => {
        const userAgents = [
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
          "curl/7.68.0",
          "Python-requests/2.25.1",
          "Postman Runtime/7.29.0",
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
      };

      for (let i = 0; i < parseInt(count); i++) {
        let threat;

        if (threatType === "random") {
          threat = threatTypes[Math.floor(Math.random() * threatTypes.length)];
        } else {
          threat =
            threatTypes.find((t) => t.event === threatType) || threatTypes[0];
        }

        const fakeReq = {
          ip: generateFakeIP(),
          get: () => generateFakeUserAgent(),
        };

        // Add some randomness to the details
        const modifiedThreat = { ...threat };
        if (modifiedThreat.event === "AUTH_FAILURE") {
          modifiedThreat.details.username = [
            "admin",
            "root",
            "administrator",
            "guest",
          ][Math.floor(Math.random() * 4)];
        }

        securityLogger.logSuspiciousActivity(
          modifiedThreat.event,
          modifiedThreat.details,
          fakeReq
        );

        threats.push({
          event: modifiedThreat.event,
          ip: fakeReq.ip,
          details: modifiedThreat.details,
          timestamp: new Date().toISOString(),
        });

        // Add small delay between logs
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      res.json({
        message: `Successfully simulated ${threats.length} security threats`,
        threats,
        threatType,
        count: threats.length,
      });
    } catch (error) {
      console.error("Error simulating threats:", error);
      res.status(500).json({ error: "Failed to simulate security threats" });
    }
  }

  /**
   * Export security logs as CSV
   */
  static async exportSecurityLogs(req, res) {
    try {
      const {
        date = new Date().toISOString().split("T")[0],
        event = "",
        severity = "",
        ip = "",
      } = req.query;

      const logFile = path.join(LOG_DIR, `security-${date}.log`);

      if (!fs.existsSync(logFile)) {
        return res.status(404).json({
          error: `No security logs found for date: ${date}`,
        });
      }

      const logContent = fs.readFileSync(logFile, "utf8");
      const logLines = logContent
        .trim()
        .split("\n")
        .filter((line) => line);

      // Parse and filter logs (same logic as getSecurityLogs)
      let logs = logLines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((log) => log !== null);

      // Apply filters
      if (event) {
        logs = logs.filter((log) =>
          log.event.toLowerCase().includes(event.toLowerCase())
        );
      }
      if (severity && logs.length > 0) {
        logs = logs.filter((log) => log.details?.severity === severity);
      }
      if (ip) {
        logs = logs.filter((log) => log.ip && log.ip.includes(ip));
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Prepare CSV
      const csvHeader = [
        "Timestamp",
        "Event",
        "Severity",
        "IP Address",
        "Username",
        "Endpoint",
        "Reason",
        "User Agent",
      ];

      const csvRows = [csvHeader.join(",")];

      logs.forEach((log) => {
        const row = [
          log.timestamp,
          log.event,
          log.details?.severity || "N/A",
          log.ip || "unknown",
          log.details?.username || "N/A",
          log.details?.endpoint || "N/A",
          log.details?.reason || "N/A",
          `"${(log.userAgent || "unknown").replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");
      const filename = `security-logs-${date}.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.status(200).send(csvContent);
    } catch (error) {
      console.error("Error exporting security logs:", error);
      res.status(500).json({ error: "Failed to export security logs" });
    }
  }
}
