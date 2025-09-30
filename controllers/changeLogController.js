import { PrismaClient } from "@prisma/client";
import { fmtDateTimeDDMMYYYY_HHmmss } from "../utils/formatedDate.js";

const prisma = new PrismaClient();

/**
 * Buat entry log perubahan
 */
export const changeLog = async (model, action, data) => {
  await prisma.changeLog.create({
    data: {
      model: model,
      action: action,
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
      const latest = await prisma.changeLog.findFirst({
        where: { model: String(model) },
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
        { model: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
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
    const total = await prisma.changeLog.count({ where });

    // Get logs with pagination
    const changeLogs = await prisma.changeLog.findMany({
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
    const totalLogs = await prisma.changeLog.count();

    // Logs by model
    const logsByModel = await prisma.changeLog.groupBy({
      by: ["model"],
      _count: { model: true },
      orderBy: { _count: { model: "desc" } },
    });

    // Logs by action
    const logsByAction = await prisma.changeLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await prisma.changeLog.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Today's activity
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayActivity = await prisma.changeLog.count({
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
        model: item.model,
        count: item._count.model,
      })),
      logsByAction: logsByAction.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
    });
  } catch (error) {
    console.error("Get changelog stats failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Export change logs as CSV attachment with full filtering support
export const exportChangeLogs = async (req, res) => {
  try {
    const { model, action, search, from, to, all } = req.query;

    // Build where clause with all available filters (same as getChangeLogs)
    const where = {};

    if (model) {
      where.model = String(model);
    }

    if (action) {
      where.action = String(action);
    }

    if (search) {
      where.OR = [
        { model: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    // Date range filter
    if (!all && (from || to)) {
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

    const logs = await prisma.changeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Prepare CSV header
    const header = ["id", "model", "action", "data", "createdAt"];
    const rows = [header.join(",")];

    for (const r of logs) {
      // ensure data is a compact JSON string and escape double quotes
      const dataStr = JSON.stringify(r.data) || "";
      const safeData = `"${String(dataStr).replace(/"/g, '""')}"`;
      const line = [
        r.id,
        r.model,
        r.action,
        safeData,
        fmtDateTimeDDMMYYYY_HHmmss(r.createdAt),
      ].join(",");
      rows.push(line);
    }

    const csv = rows.join("\n");

    // Generate descriptive filename based on filters
    let filename = "changelog";
    if (model) filename += `-${model.toLowerCase()}`;
    if (action) filename += `-${action.toLowerCase()}`;
    if (from && to) filename += `-${from}-to-${to}`;
    else if (from) filename += `-from-${from}`;
    else if (to) filename += `-until-${to}`;
    filename += `-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export change logs failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
