import { prisma } from "../utils/prisma.js";
export class AreaService {
  /**
   * Buat atau update area berdasarkan nama
   */
  static async upsertByName(name) {
    return prisma.area.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  /**
   * Ambil daftar semua area
   */
  static async list() {
    return prisma.area.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * Update area berdasarkan ID
   */
  static async update(id, data) {
    return prisma.area.update({
      where: { id },
      data,
    });
  }

  /**
   * Hapus area berdasarkan ID
   */
  static async delete(id) {
    return prisma.area.delete({
      where: { id },
    });
  }

  /**
   * Cek apakah area memiliki foto
   */
  static async hasPhotos(areaId) {
    const count = await prisma.photo.count({
      where: { areaId },
    });
    return count > 0;
  }
}
