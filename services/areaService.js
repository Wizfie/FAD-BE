import { prisma } from "../utils/prisma.js";
export class AreaService {
  static async upsertByName(name) {
    return prisma.area.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  static async list() {
    return prisma.area.findMany({
      orderBy: { name: "asc" },
    });
  }
}
