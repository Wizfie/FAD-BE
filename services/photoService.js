import { prisma } from "../utils/prisma.js";
import { getRange } from "../utils/dateRange.js";

export class PhotoService {
  static async createMany({ areaId, files, publicBaseUrl, takenAt }) {
    const taken = takenAt ? new Date(takenAt) : undefined;
    const photosData = files.map((f) => ({
      areaId,
      filename: f.filename,
      originalName: f.originalname || "",
      mime: f.mimetype,
      size: f.size,
      url: `${publicBaseUrl}/uploads/${f.filename}`,
      takenAt: taken,
    }));
    return prisma.photo.createMany({ data: photosData });
  }

  static async list({ areaId, period, date, page = 1, pageSize = 24 }) {
    const where = {};
    if (areaId) where.areaId = areaId;
    if (period) {
      const { start, end } = getRange(date, period);
      where.createdAt = { gte: start, lte: end };
    }

    const [total, items] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { area: true },
      }),
    ]);
    return { total, items, page, pageSize };
  }

  static async remove(id) {
    return prisma.photo.delete({ where: { id } });
  }
}
