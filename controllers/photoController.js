// controllers/photoController.js
import { PhotoService } from "../services/photoService.js";
import { AreaService } from "../services/areaService.js";
import { env } from "../config/env.js";

export class PhotoController {
  static async upload(req, res) {
    try {
      const { areaId, areaName, takenAt } = req.body;

      let finalAreaId = areaId ? Number(areaId) : undefined;
      if (!finalAreaId && areaName) {
        // Wajib pakai () agar await kena ke promise-nya dulu
        const area = await AreaService.upsertByName(areaName.trim());
        finalAreaId = area.id;
      }

      if (!finalAreaId) {
        return res.status(400).json({ message: "area wajib di isi" });
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: "tidak ada file" });
      }

      const created = await PhotoService.createMany({
        areaId: finalAreaId,
        files,
        publicBaseUrl: env.BASE_URL,
        takenAt,
      });

      return res
        .status(201)
        .json({ message: "Upload Berhasil", count: created.count });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(400).json({ message: "Gagal upload" });
    }
  }

  static async list(req, res) {
    const { areaId, period, date, page, pageSize } = req.query;
    const data = await PhotoService.list({
      areaId: areaId ? Number(areaId) : undefined,
      period,
      date,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    // konsisten dengan FE contoh sebelumnya
    return res.json(data);
  }

  static async remove(req, res) {
    await PhotoService.remove(Number(req.params.id));
    return res.json({ message: "Foto dihapus" });
  }
}
