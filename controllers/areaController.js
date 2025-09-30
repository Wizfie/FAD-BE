import { AreaService } from "../services/areaService.js";

export class AreaController {
  /**
   * List semua area
   */
  static async list(_req, res) {
    const areas = await AreaService.list();
    res.json({ data: areas });
  }

  /**
   * Buat area baru
   */
  static async create(req, res) {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Nama area wajib diisi" });
      }

      const area = await AreaService.upsertByName(name.trim());

      return res.status(201).json({
        message: "Area berhasil dibuat",
        data: area,
      });
    } catch (error) {
      console.error("Create area error:", error);
      return res.status(500).json({ message: "Gagal membuat area" });
    }
  }

  /**
   * Update area berdasarkan ID
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Nama area wajib diisi" });
      }

      const area = await AreaService.update(Number(id), {
        name: name.trim(),
      });

      return res.json({
        message: "Area berhasil diupdate",
        data: area,
      });
    } catch (error) {
      console.error("Update area error:", error);
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Area tidak ditemukan" });
      }
      return res.status(500).json({ message: "Gagal mengupdate area" });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if area has photos
      const hasPhotos = await AreaService.hasPhotos(Number(id));
      if (hasPhotos) {
        return res.status(400).json({
          message: "Tidak dapat menghapus area yang masih memiliki foto",
        });
      }

      await AreaService.delete(Number(id));

      return res.json({
        message: "Area berhasil dihapus",
      });
    } catch (error) {
      console.error("Delete area error:", error);
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Area tidak ditemukan" });
      }
      return res.status(500).json({ message: "Gagal menghapus area" });
    }
  }
}
