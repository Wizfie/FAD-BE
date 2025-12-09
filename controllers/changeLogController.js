import { PrismaClient } from "@prisma/client";
import { fmtDateTimeDDMMYYYY_HHmmss } from "../utils/formatedDate.js";

const prisma = new PrismaClient();

/**
 * Buat entry log perubahan
 */
export const changeLog = async (model, action, data) => {
  await prisma.auditLog.create({
    data: {
      entity: model,
      operation: action,
      data: data,
    },
  });
};

/**
 * Ambil daftar change logs dengan filter
 */
export const getChangeLogs = async (req, res) => {
  try {
    const {
      model,
      last,
      action,
      page = 1,
      pageSize = 10,
      search,
      from,
      to,
    } = req.query;

    if (model && String(last) === "true") {
      // Return change log terbaru untuk model yang diberikan
      const latest = await prisma.auditLog.findFirst({
        where: { entity: String(model) },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      return res
        .status(200)
        .json({ lastUpdate: latest ? { timestamp: latest.createdAt } : null });
    }

    // Build where clause with filters
    const where = {};

    if (model) {
      where.model = String(model);
    }

    if (action) {
      where.action = String(action);
    }

    if (search) {
      where.OR = [
        { entity: { contains: search, mode: "insensitive" } },
        { operation: { contains: search, mode: "insensitive" } },
      ];
    }

    // Date range filter
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Pagination
    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const skip = (pageNum - 1) * limit;

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get logs with pagination
    const changeLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    res.status(200).json({
      logs: changeLogs,
      pagination: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get change logs failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get changelog statistics
export const getChangeLogStats = async (req, res) => {
  try {
    // Total logs
    const totalLogs = await prisma.auditLog.count();

    // Logs by model
    const logsByModel = await prisma.auditLog.groupBy({
      by: ["model"],
      _count: { entity: true },
      orderBy: { _count: { entity: "desc" } },
    });

    // Logs by action
    const logsByAction = await prisma.auditLog.groupBy({
      by: ["action"],
      _count: { operation: true },
      orderBy: { _count: { operation: "desc" } },
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await prisma.auditLog.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Today's activity
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayActivity = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    res.status(200).json({
      totalLogs,
      recentActivity,
      todayActivity,
      logsByModel: logsByModel.map((item) => ({
        entity: item.model,
        count: item._count.model,
      })),
      logsByAction: logsByAction.map((item) => ({
        operation: item.action,
        count: item._count.action,
      })),
    });
  } catch (error) {
    console.error("Get changelog stats failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get audit log summary for dashboard cards
 */
export const getAuditLogSummary = async (req, res) => {
  try {
    const { timeframe = "today" } = req.query;

    // Calculate date range based on timeframe
    let startDate = new Date();
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    switch (timeframe) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "last7days":
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "last30days":
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const dateFilter = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // 1. Total Activity
    const totalActivity = await prisma.auditLog.count({
      where: dateFilter,
    });

    // 2. FAD Operations (CREATE, UPDATE, DELETE)
    const fadOperations = await prisma.auditLog.groupBy({
      by: ["operation"],
      where: {
        ...dateFilter,
        entity: "FAD",
        operation: { in: ["CREATE", "UPDATE", "DELETE"] },
      },
      _count: { operation: true },
    });

    const fadOpsMap = {
      create: 0,
      update: 0,
      delete: 0,
    };
    fadOperations.forEach((op) => {
      const key = op.operation.toLowerCase();
      fadOpsMap[key] = op._count.operation;
    });

    // 3. Security Events (LOGIN_FAILED, UNAUTHORIZED_ACCESS)
    const securityEvents = await prisma.auditLog.groupBy({
      by: ["operation"],
      where: {
        ...dateFilter,
        operation: {
          in: ["LOGIN_FAILED", "UNAUTHORIZED_ACCESS", "SUSPICIOUS_ACTIVITY"],
        },
      },
      _count: { operation: true },
    });

    let loginFailed = 0;
    let unauthorized = 0;
    securityEvents.forEach((ev) => {
      if (ev.operation === "LOGIN_FAILED") {
        loginFailed = ev._count.operation;
      } else if (
        ev.operation === "UNAUTHORIZED_ACCESS" ||
        ev.operation === "SUSPICIOUS_ACTIVITY"
      ) {
        unauthorized += ev._count.operation;
      }
    });

    // 4. Active Users (Top 5)
    const activeUsers = await prisma.auditLog.groupBy({
      by: ["username"],
      where: {
        ...dateFilter,
        username: { not: null },
      },
      _count: { username: true },
      orderBy: { _count: { username: "desc" } },
      take: 5,
    });

    const activeUsersList = activeUsers.map((user) => ({
      username: user.username || "Unknown",
      count: user._count.username,
    }));

    res.status(200).json({
      totalActivity,
      fadOperations: fadOpsMap,
      securityEvents: {
        loginFailed,
        unauthorized,
      },
      activeUsers: activeUsersList,
      timeframe,
    });
  } catch (error) {
    console.error("Get audit log summary failed:", error);
    // Return default values on error instead of 500
    res.status(200).json({
      totalActivity: 0,
      fadOperations: { create: 0, update: 0, delete: 0 },
      securityEvents: { loginFailed: 0, unauthorized: 0 },
      activeUsers: [],
      timeframe: req.query.timeframe || "today",
      error: error.message,
    });
  }
};

/**
 * Export audit logs as CSV
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit to prevent memory issues
    });

    // CSV header
    const header = [
      "ID",
      "Entity",
      "Entity ID",
      "Operation",
      "User ID",
      "Username",
      "Changes",
      "Created At",
    ];
    const rows = [header.join(",")];

    // CSV rows
    for (const log of logs) {
      const changesStr = log.changes
        ? JSON.stringify(log.changes).replace(/"/g, '""')
        : "";
      const row = [
        log.id,
        log.entity || "",
        log.entityId || "",
        log.operation || "",
        log.userId || "",
        log.username || "",
        `"${changesStr}"`,
        log.createdAt.toISOString(),
      ];
      rows.push(row.join(","));
    }

    const csv = rows.join("\n");

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `audit-logs-${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export audit logs failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
