/**
 * PhotoController - Mengelola upload dan data foto
 * - POST /api/photos: mendukung multipart upload dengan metadata per-file
 * - GET /api/photos: men        });

        // Cek apakah group sudah completeung query params category, comparisonGroupId, groupByComparison
 * - POST /api/comparison-groups dan GET /api/comparison-groups: kelola grup
 */
import { PhotoService } from "../services/photoService.js";
import { AreaService } from "../services/areaService.js";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { changeLog } from "./changeLogController.js";
import { logger } from "../utils/logger.js";

export class PhotoController {
  /**
   * Upload foto dengan metadata per-file
   */
  static async upload(req, res) {
    try {
      logger.request(req, "📥 Upload request received");
      logger.debug("Upload details", {
        body: req.body,
        filesCount: req.files?.length || 0,
        files: req.files?.map((f) => ({
          filename: f.filename,
          originalname: f.originalname,
          size: f.size,
        })),
      });

      // Expect body fields: areaId atau areaName, opsional comparisonGroupId atau comparisonGroupTitle
      // dan metadata per-file dalam `fileMeta` (JSON array sejajar dengan files[])
      const { areaId, areaName, comparisonGroupId, comparisonGroupTitle } =
        req.body;

      let finalAreaId = areaId ? Number(areaId) : undefined;
      if (!finalAreaId && areaName) {
        const area = await AreaService.upsertByName(areaName.trim());
        finalAreaId = area.id;
      }

      if (!finalAreaId) {
        return res.status(400).json({ message: "area wajib di isi" });
      }

      // Jika client minta buat group baru inline
      // tentukan finalGroupId (prioritaskan numeric comparisonGroupId)
      let finalGroupId = undefined;
      if (comparisonGroupId) {
        const n = Number(comparisonGroupId);
        if (!Number.isNaN(n)) finalGroupId = n;
      }
      // buat group inline ketika title non-empty disediakan
      if (
        !finalGroupId &&
        comparisonGroupTitle &&
        comparisonGroupTitle.trim()
      ) {
        const g = await PhotoService.createGroup({
          title: comparisonGroupTitle.trim(),
          areaId: finalAreaId,
        });
        finalGroupId = g.id;
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: "tidak ada file" });
      }

      // fileMeta: bisa dikirim dalam berbagai bentuk. Normalisasi ke array objek.
      let fileMeta = [];
      if (req.body.fileMeta) {
        try {
          const raw = req.body.fileMeta;
          if (Array.isArray(raw)) {
            fileMeta = raw.map((m) => {
              if (!m) return {};
              if (typeof m === "string") {
                try {
                  return JSON.parse(m);
                } catch (_) {
                  return {};
                }
              }
              // sudah berupa objek
              return m;
            });
          } else if (typeof raw === "string") {
            const s = raw.trim();
            // kasus: string JSON array
            if (s.startsWith("[")) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) fileMeta = parsed;
                else fileMeta = [parsed];
              } catch (err) {
                // fallback: coba split jadi potongan JSON
                const parts = s.split(/}\s*,\s*\{/); // coba split antar objek
                fileMeta = parts.map((p, idx) => {
                  let piece = p;
                  if (idx > 0) piece = "{" + piece;
                  if (idx < parts.length - 1) piece = piece + "}";
                  try {
                    return JSON.parse(piece);
                  } catch (_) {
                    return {};
                  }
                });
              }
            } else {
              // string objek JSON tunggal
              try {
                fileMeta = [JSON.parse(s)];
              } catch (err) {
                // format tidak dikenal → biarkan kosong
                console.warn("fileMeta parse fallback failed", err, s);
                fileMeta = [];
              }
            }
          } else if (typeof raw === "object") {
            // mungkin disediakan sebagai objek berkey numerik seperti {0: '{...}', 1: '{...}'}
            const keys = Object.keys(raw);
            const isNumericMap =
              keys.length && keys.every((k) => /^\d+$/.test(k));
            if (isNumericMap) {
              const arr = keys
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => raw[k]);
              fileMeta = arr.map((m) => {
                if (!m) return {};
                if (typeof m === "string") {
                  try {
                    return JSON.parse(m);
                  } catch (_) {
                    return {};
                  }
                }
                return m;
              });
            } else {
              fileMeta = [raw];
            }
          }
        } catch (err) {
          console.warn("fileMeta parse error", err, "raw=", req.body.fileMeta);
        }
      }

      logger.debug("Parsed file metadata", {
        fileMetaCount: fileMeta.length,
        filesCount: (req.files || []).length,
      });

      // Pastikan setiap meta memiliki comparisonGroupId jika finalGroupId ada
      const filledMeta = [];
      const allowedCats = ["before", "action", "after"];

      // Jika upload ke group yang sudah ada, cek status completion dan limit foto
      if (finalGroupId) {
        const existingPhotos = await prisma.photo.findMany({
          where: { comparisonGroupId: finalGroupId },
          select: { category: true },
        });

        const existingCategories = {
          before: existingPhotos.filter((p) => p.category === "BEFORE").length,
          action: existingPhotos.filter((p) => p.category === "ACTION").length,
          after: existingPhotos.filter((p) => p.category === "AFTER").length,
        };

        // Check if group is already complete
        const isComplete =
          existingCategories.before > 0 &&
          existingCategories.action > 0 &&
          existingCategories.after > 0;

        if (isComplete) {
          return res.status(400).json({
            message:
              "Grup ini sudah selesai (memiliki foto Before, Action, dan After). Silakan buat grup baru.",
          });
        }
      }

      for (let i = 0; i < files.length; i++) {
        const raw = fileMeta[i] || {};
        const m = { ...(raw || {}) };
        const providedCg = m?.comparisonGroupId
          ? Number(m.comparisonGroupId)
          : undefined;
        m.comparisonGroupId = !Number.isNaN(providedCg)
          ? providedCg
          : finalGroupId;

        // validasi nilai category jika disediakan
        if (m.category) {
          const c = String(m.category).toLowerCase();
          if (!allowedCats.includes(c)) {
            return res.status(400).json({
              message: `invalid category for file ${i}: ${m.category}`,
            });
          }
          m.category = c;

          // Jika upload ke group yang sudah ada, cek apakah category ini sudah ada fotonya
          if (finalGroupId) {
            const existingPhotos = await prisma.photo.findMany({
              where: {
                comparisonGroupId: finalGroupId,
                category: c.toUpperCase(),
              },
            });

            if (existingPhotos.length > 0) {
              return res.status(400).json({
                message: `Grup ini sudah memiliki foto untuk kategori ${c}. Setiap grup hanya boleh 1 foto per kategori.`,
              });
            }
          }
        }

        // validasi takenAt (opsional) — jika disediakan, pastikan tanggal valid
        if (m.takenAt) {
          const d = new Date(m.takenAt);
          if (isNaN(d)) {
            return res
              .status(400)
              .json({ message: `invalid takenAt for file ${i}: ${m.takenAt}` });
          }
          m.takenAt = d.toISOString();
        }

        filledMeta.push(m);
      }
      fileMeta = filledMeta;

      const created = await PhotoService.createMany({
        areaId: finalAreaId,
        files,
        publicBaseUrl: env.BASE_URL,
        fileMeta,
      });

      // Log upload foto ke changelog
      await changeLog("PHOTO", "UPLOAD", {
        count: created.count,
        areaId: finalAreaId,
        comparisonGroupId: finalGroupId,
        files: files.map((f) => ({
          filename: f.filename,
          originalname: f.originalname,
        })),
      });

      return res.status(201).json({
        message: "Upload Berhasil",
        count: created.count,
        comparisonGroupId: finalGroupId,
      });
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Upload error stack:", error.stack);
      console.error("Upload error message:", error.message);
      return res.status(500).json({
        message: "Gagal upload",
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  /**
   * Ambil daftar foto dengan filter
   */
  static async list(req, res) {
    const {
      areaId,
      period,
      date,
      page,
      pageSize,
      category,
      comparisonGroupId,
      groupByComparison,
    } = req.query;
    const cgId = comparisonGroupId ? Number(comparisonGroupId) : undefined;
    const safeCgId = !Number.isNaN(cgId) ? cgId : undefined;
    const data = await PhotoService.list({
      areaId: areaId ? Number(areaId) : undefined,
      period,
      date,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      category,
      comparisonGroupId: safeCgId,
      groupByComparison:
        groupByComparison === "true" || groupByComparison === "1",
    });
    // konsisten dengan FE contoh sebelumnya
    return res.json(data);
  }

  /**
   * Buat comparison group baru
   */
  static async createGroup(req, res) {
    const { title, areaId, areaName, description } = req.body;
    if (!title) return res.status(400).json({ message: "title required" });
    let finalAreaId = areaId ? Number(areaId) : undefined;
    if (!finalAreaId && areaName) {
      const a = await AreaService.upsertByName(String(areaName).trim());
      finalAreaId = a.id;
    }
    const g = await PhotoService.createGroup({
      title,
      areaId: finalAreaId,
      description: description || null,
    });
    return res.status(201).json(g);
  }

  /**
   * Ambil daftar comparison groups
   */
  static async listGroups(req, res) {
    const { areaId, page, pageSize } = req.query;
    const data = await PhotoService.listGroups({
      areaId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 24,
    });
    return res.json(data);
  }

  /**
   * Ambil detail comparison group berdasarkan ID
   */
  static async getGroup(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    const g = await prisma.comparisonGroup.findUnique({
      where: { id },
      include: { photos: true, area: true },
    });
    if (!g) return res.status(404).json({ message: "group not found" });
    return res.json(g);
  }

  /**
   * Update comparison group
   */
  static async updateGroup(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    const { title, description, keterangan } = req.body;

    logger.debug("Update group request", {
      id,
      title,
      description,
      keterangan,
    });

    try {
      const updated = await PhotoService.updateGroup(id, {
        title,
        description,
        keterangan,
      });
      logger.operation("UPDATE", "PHOTO_GROUP", {
        id: updated.id,
        title: updated.title,
      });
      return res.json(updated);
    } catch (err) {
      logger.error("Update group error", {
        error: err.message,
        groupId: id,
        userId: req.user?.id,
      });
      return res
        .status(500)
        .json({ message: "Failed update group", error: err.message });
    }
  }

  /**
   * Delete comparison group
   */
  static async deleteGroup(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "invalid id" });
    }

    try {
      // Check if group exists
      const existingGroup = await prisma.comparisonGroup.findUnique({
        where: { id },
        include: { photos: true },
      });

      if (!existingGroup) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Delete all photos in the group first (cascade delete)
      await prisma.photo.deleteMany({
        where: { comparisonGroupId: id },
      });

      // Delete the group
      await prisma.comparisonGroup.delete({
        where: { id },
      });

      logger.operation("DELETE", "PHOTO_GROUP", { id });
      return res.json({ message: "Group deleted successfully" });
    } catch (err) {
      logger.error("Delete group error", {
        error: err.message,
        groupId: id,
        userId: req.user?.id,
      });
      return res
        .status(500)
        .json({ message: "Failed to delete group", error: err.message });
    }
  }

  /**
   * Update foto (keterangan, dll)
   */
  static async update(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });

    try {
      const { keterangan } = req.body;

      // Cek apakah foto exists
      const existingPhoto = await prisma.photo.findUnique({
        where: { id },
      });

      if (!existingPhoto) {
        return res.status(404).json({ message: "Foto tidak ditemukan" });
      }

      const updatedPhoto = await prisma.photo.update({
        where: { id },
        data: {
          keterangan: keterangan || null,
        },
      });

      // Log update foto ke changelog
      await changeLog("PHOTO", "UPDATE", {
        id: updatedPhoto.id,
        filename: updatedPhoto.filename,
        keterangan: updatedPhoto.keterangan,
        areaId: updatedPhoto.areaId,
        comparisonGroupId: updatedPhoto.comparisonGroupId,
        category: updatedPhoto.category,
      });

      return res.json({
        message: "Foto berhasil diupdate",
        photo: updatedPhoto,
      });
    } catch (err) {
      console.error("Update photo error", err);
      return res.status(500).json({
        message: "Gagal mengupdate foto",
        error: err.message,
      });
    }
  }

  /**
   * Hapus foto berdasarkan ID
   */
  static async remove(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    try {
      // Ambil info foto sebelum dihapus untuk changelog
      const photo = await prisma.photo.findUnique({ where: { id } });

      if (!photo) {
        return res.status(404).json({
          success: false,
          message: "Foto tidak ditemukan",
        });
      }

      // Remove photo (file + database record)
      await PhotoService.remove(id);

      // Log penghapusan foto ke changelog
      if (photo) {
        await changeLog("PHOTO", "DELETE", {
          id: photo.id,
          filename: photo.filename,
          areaId: photo.areaId,
          comparisonGroupId: photo.comparisonGroupId,
          category: photo.category,
        });
      }

      return res.json({
        success: true,
        message: "Foto berhasil dihapus",
        data: { deletedPhotoId: id },
      });
    } catch (err) {
      console.error("Remove photo error", err);
      // jika prisma throw karena not found, return 404
      return res.status(404).json({
        success: false,
        message: "Foto tidak ditemukan",
      });
    }
  }
}
