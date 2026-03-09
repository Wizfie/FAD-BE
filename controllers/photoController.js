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
import ApiError from "../utils/ApiError.js";

export class PhotoController {
  /**
   * Upload foto dengan metadata per-file
   */
  static async upload(req, res, next) {
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

      const { areaId, areaName, comparisonGroupId, comparisonGroupTitle } =
        req.body;

      let finalAreaId = areaId ? Number(areaId) : undefined;
      if (!finalAreaId && areaName) {
        const area = await AreaService.upsertByName(areaName.trim());
        finalAreaId = area.id;
      }

      if (!finalAreaId) {
        throw ApiError.badRequest("Area wajib diisi", "MISSING_AREA");
      }

      let finalGroupId = undefined;
      if (comparisonGroupId) {
        const n = Number(comparisonGroupId);
        if (!Number.isNaN(n)) finalGroupId = n;
      }
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
        throw ApiError.badRequest("Tidak ada file", "NO_FILES");
      }

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
              return m;
            });
          } else if (typeof raw === "string") {
            const s = raw.trim();
            if (s.startsWith("[")) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) fileMeta = parsed;
                else fileMeta = [parsed];
              } catch (err) {
                const parts = s.split(/}\s*,\s*\{/);
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
              try {
                fileMeta = [JSON.parse(s)];
              } catch (err) {
                console.warn("fileMeta parse fallback failed", err, s);
                fileMeta = [];
              }
            }
          } else if (typeof raw === "object") {
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

      const filledMeta = [];
      const allowedCats = ["before", "action", "after"];

      // Check group completion status
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

        const isComplete =
          existingCategories.before > 0 &&
          existingCategories.action > 0 &&
          existingCategories.after > 0;

        if (isComplete) {
          throw ApiError.conflict(
            "Grup ini sudah selesai (memiliki foto Before, Action, dan After). Silakan buat grup baru.",
            "GROUP_ALREADY_COMPLETE",
            { groupId: finalGroupId }
          );
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

        if (m.category) {
          const c = String(m.category).toLowerCase();
          if (!allowedCats.includes(c)) {
            throw ApiError.badRequest(
              `Invalid category for file ${i}: ${m.category}`,
              "INVALID_CATEGORY",
              { fileIndex: i, category: m.category }
            );
          }
          m.category = c;

          if (finalGroupId) {
            const existingPhotos = await prisma.photo.findMany({
              where: {
                comparisonGroupId: finalGroupId,
                category: c.toUpperCase(),
              },
            });

            if (existingPhotos.length > 0) {
              throw ApiError.conflict(
                `Grup ini sudah memiliki foto untuk kategori ${c}. Setiap grup hanya boleh 1 foto per kategori.`,
                "CATEGORY_ALREADY_EXISTS",
                { groupId: finalGroupId, category: c }
              );
            }
          }
        }

        if (m.takenAt) {
          const d = new Date(m.takenAt);
          if (isNaN(d)) {
            throw ApiError.badRequest(
              `Invalid takenAt for file ${i}: ${m.takenAt}`,
              "INVALID_DATE",
              { fileIndex: i, takenAt: m.takenAt }
            );
          }
          m.takenAt = d.toISOString();
        }

        filledMeta.push(m);
      }
      fileMeta = filledMeta;

      const created = await PhotoService.createMany({
        areaId: finalAreaId,
        files,
        fileMeta,
      });

      await changeLog(
        "PHOTO",
        "UPLOAD",
        {
          id: created.photos?.[0]?.id,
          count: created.count,
          photoIds: created.photos?.map((p) => p.id) || [],
          areaId: finalAreaId,
          comparisonGroupId: finalGroupId,
          files: files.map((f) => ({
            filename: f.filename,
            originalname: f.originalname,
          })),
        },
        req.user
      );

      return res.status(201).json({
        success: true,
        message: "Upload Berhasil",
        count: created.count,
        photos: created.photos,
        comparisonGroupId: finalGroupId,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ambil daftar foto dengan filter
   */
  static async list(req, res, next) {
    try {
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
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Buat comparison group baru
   */
  static async createGroup(req, res, next) {
    try {
      const { title, areaId, areaName, description } = req.body;
      if (!title) throw ApiError.badRequest("Title required", "MISSING_TITLE");

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
      return res.status(201).json({ success: true, data: g });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ambil daftar comparison groups
   */
  static async listGroups(req, res, next) {
    try {
      const { areaId, page, pageSize } = req.query;
      const data = await PhotoService.listGroups({
        areaId,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 24,
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ambil detail comparison group berdasarkan ID
   */
  static async getGroup(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        throw ApiError.badRequest("Invalid ID", "INVALID_ID");
      }
      const g = await prisma.comparisonGroup.findUnique({
        where: { id },
        include: { photos: true, area: true },
      });
      if (!g)
        throw ApiError.notFound("Group tidak ditemukan", "GROUP_NOT_FOUND", {
          groupId: id,
        });
      return res.json({ success: true, data: g });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update comparison group
   */
  static async updateGroup(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        throw ApiError.badRequest("Invalid ID", "INVALID_ID");
      }
      const { title, description, keterangan } = req.body;

      logger.debug("Update group request", {
        id,
        title,
        description,
        keterangan,
      });

      const updated = await PhotoService.updateGroup(id, {
        title,
        description,
        keterangan,
      });
      logger.operation("UPDATE", "PHOTO_GROUP", {
        id: updated.id,
        title: updated.title,
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete comparison group
   */
  static async deleteGroup(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        throw ApiError.badRequest("Invalid ID", "INVALID_ID");
      }

      const existingGroup = await prisma.comparisonGroup.findUnique({
        where: { id },
        include: { photos: true },
      });

      if (!existingGroup) {
        throw ApiError.notFound("Group tidak ditemukan", "GROUP_NOT_FOUND", {
          groupId: id,
        });
      }

      await prisma.photo.deleteMany({
        where: { comparisonGroupId: id },
      });

      await prisma.comparisonGroup.delete({
        where: { id },
      });

      logger.operation("DELETE", "PHOTO_GROUP", { id });
      return res.json({ success: true, message: "Group deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update foto (keterangan, dll)
   */
  static async update(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        throw ApiError.badRequest("Invalid ID", "INVALID_ID");
      }

      const { keterangan } = req.body;

      const existingPhoto = await prisma.photo.findUnique({
        where: { id },
      });

      if (!existingPhoto) {
        throw ApiError.notFound("Foto tidak ditemukan", "PHOTO_NOT_FOUND", {
          photoId: id,
        });
      }

      const updatedPhoto = await prisma.photo.update({
        where: { id },
        data: {
          keterangan: keterangan || null,
        },
      });

      await changeLog(
        "PHOTO",
        "UPDATE",
        {
          id: updatedPhoto.id,
          filename: updatedPhoto.filename,
          keterangan: updatedPhoto.keterangan,
          areaId: updatedPhoto.areaId,
          comparisonGroupId: updatedPhoto.comparisonGroupId,
          category: updatedPhoto.category,
        },
        req.user
      );

      return res.json({
        success: true,
        message: "Foto berhasil diupdate",
        data: updatedPhoto,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hapus foto berdasarkan ID
   */
  static async remove(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        throw ApiError.badRequest("Invalid ID", "INVALID_ID");
      }

      const photo = await prisma.photo.findUnique({ where: { id } });

      if (!photo) {
        throw ApiError.notFound("Foto tidak ditemukan", "PHOTO_NOT_FOUND", {
          photoId: id,
        });
      }

      await PhotoService.remove(id);

      if (photo) {
        await changeLog(
          "PHOTO",
          "DELETE",
          {
            id: photo.id,
            filename: photo.filename,
            areaId: photo.areaId,
            comparisonGroupId: photo.comparisonGroupId,
            category: photo.category,
          },
          req.user
        );
      }

      return res.json({
        success: true,
        message: "Foto berhasil dihapus",
        data: { deletedPhotoId: id },
      });
    } catch (error) {
      next(error);
    }
  }
}
