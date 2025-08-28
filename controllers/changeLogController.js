import { PrismaClient } from "@prisma/client";
import { fmtDateTimeDDMMYYYY_HHmmss } from "../utils/formatedDate.js";

const prisma = new PrismaClient();

export const changeLog = async (model, action, data) => {
  await prisma.changeLog.create({
    data: {
      model: model,
      action: action,
      data: data,
    },
  });
};

export const getChangeLogs = async (req, res) => {
  try {
    const { model, last } = req.query;

    if (model && String(last) === "true") {
      // Return the most recent change log for the given model
      const latest = await prisma.changeLog.findFirst({
        where: { model: String(model) },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      return res
        .status(200)
        .json({ lastUpdate: latest ? { timestamp: latest.createdAt } : null });
    }

    // Default: return full list (be mindful of pagination in future)
    const changeLogs = await prisma.changeLog.findMany();
    res.status(200).json(changeLogs);
  } catch (error) {
    console.error("Get change logs failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Export change logs as CSV attachment. Optional query: ?model=FAD
export const exportChangeLogs = async (req, res) => {
  try {
    const { model, from, to, all } = req.query;

    // Build where clause optionally filtering by model and createdAt range
    const where = {};
    if (model) where.model = String(model);

    // If not requesting "all", and from/to provided, filter createdAt
    if (!all) {
      let start = null;
      let end = null;
      if (from) {
        const d = new Date(from);
        if (!isNaN(d)) {
          start = new Date(d);
          start.setHours(0, 0, 0, 0);
        }
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d)) {
          end = new Date(d);
          end.setHours(23, 59, 59, 999);
        }
      }
      if (start || end) {
        where.createdAt = {};
        if (start) where.createdAt.gte = start;
        if (end) where.createdAt.lte = end;
      }
    }

    const logs = await prisma.changeLog.findMany({
      where: Object.keys(where).length ? where : undefined,
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
    const filename = `change-log-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export change logs failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
