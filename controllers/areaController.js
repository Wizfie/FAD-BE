import { AreaService } from "../services/areaService.js";
import { changeLog } from "./changeLogController.js";
import { logger } from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

export class AreaController {
  /**
   * List semua area
   */
  static async list(_req, res, next) {
    try {
      const areas = await AreaService.list();
      res.json({ success: true, data: areas });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Buat area baru
   */
  static async create(req, res, next) {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw ApiError.badRequest("Nama area wajib diisi", "MISSING_AREA_NAME");
      }

      const area = await AreaService.upsertByName(name.trim());

      // Log area creation to changelog
      await changeLog(
        "AREA",
        "CREATE",
        {
          id: area.id,
          name: area.name,
        },
        req.user
      );

      logger.operation("CREATE", "AREA", { id: area.id, name: area.name });

      return res.status(201).json({
        success: true,
        message: "Area berhasil dibuat",
        data: area,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update area berdasarkan ID
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw ApiError.badRequest("Nama area wajib diisi", "MISSING_AREA_NAME");
      }

      const area = await AreaService.update(Number(id), {
        name: name.trim(),
      });

      // Log area update to changelog
      await changeLog(
        "AREA",
        "UPDATE",
        {
          id: area.id,
          name: area.name,
        },
        req.user
      );

      logger.operation("UPDATE", "AREA", { id: area.id, name: area.name });

      return res.json({
        success: true,
        message: "Area berhasil diupdate",
        data: area,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Check if area has photos
      const hasPhotos = await AreaService.hasPhotos(Number(id));
      if (hasPhotos) {
        throw ApiError.conflict(
          "Tidak dapat menghapus area yang masih memiliki foto",
          "AREA_HAS_PHOTOS",
          { areaId: Number(id) }
        );
      }

      const deletedArea = await AreaService.delete(Number(id));

      // Log area deletion to changelog
      await changeLog(
        "AREA",
        "DELETE",
        {
          id: Number(id),
        },
        req.user
      );

      logger.operation("DELETE", "AREA", { id: Number(id) });

      return res.json({
        success: true,
        message: "Area berhasil dihapus",
      });
    } catch (error) {
      next(error);
    }
  }
}
