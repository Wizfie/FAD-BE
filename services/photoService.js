/**
 * PhotoService - Service untuk mengelola foto
 * Dukungan:
 * - metadata per-file (category, takenAt, comparisonGroupId)
 * - pembuatan/listing ComparisonGroup
 * - listing foto dengan filter: category, comparisonGroupId, groupByComparison
 */
import { prisma } from "../utils/prisma.js";
import { getRange } from "../utils/dateRange.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";

/**
 * Dapatkan nama thumbnail dari filename
 */
function getThumbName(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return `${name}_thumb${ext}`;
}

/**
 * Konversi file HEIC ke JPEG
 */
async function convertHeicToJpeg(file) {
  const srcPath = path.join(env.UPLOAD_DIR, file.filename); // .../xxx.heic
  const dstName = file.filename.replace(/\.heic$/i, ".jpg"); // xxx.jpg
  const dstPath = path.join(env.UPLOAD_DIR, dstName);

  // Catatan: sharp dapat membaca HEIC jika libvips mendukung (prebuilt biasanya sudah oke).
  await sharp(srcPath).jpeg({ quality: 80 }).toFile(dstPath);
  try {
    fs.unlinkSync(srcPath);
  } catch {} // hapus HEIC asli

  // Update metadata agar sistem memakai .jpg
  file.filename = dstName;
  file.mimetype = "image/jpeg";
  file.originalname = (file.originalname || "").replace(/\.heic$/i, ".jpg");
}

async function makeThumb(fullPath, thumbPath, mime) {
  let img = sharp(fullPath).rotate();

  if (mime == "image/jpeg") {
    await img.resize({ width: 320 }).jpeg({ quality: 70 }).toFile(thumbPath);
  } else if (mime == "image/png") {
    await img
      .resize({ width: 320 })
      .png({ compressionLevel: 8 })
      .toFile(thumbPath);
  } else {
    await img.resize({ width: 320 }).toFile(thumbPath);
  }
}

export class PhotoService {
  // createMany now accepts files plus optional per-file metadata array (fileMeta)
  // fileMeta is an array of objects: { category, takenAt, comparisonGroupId }
  static async createMany({ areaId, files, fileMeta = [] }) {
    // 1) HEIC → JPEG
    for (const f of files) {
      if (
        (f.mimetype || "").toLowerCase() === "image/heic" ||
        /\.heic$/i.test(f.filename)
      ) {
        try {
          await convertHeicToJpeg(f);
        } catch (err) {
          console.error("Gagal konversi HEIC → JPEG:", f.filename, err);
          throw new Error(
            "Konversi HEIC gagal. Coba lagi atau ubah ke JPG/PNG."
          );
        }
      }
    }

    // 2) Generate thumbnail
    for (const f of files) {
      const fullPath = path.join(env.UPLOAD_DIR, "TPS", f.filename);
      const ext = path.extname(f.filename).toLowerCase();
      const mimeForThumb = ext === ".png" ? "image/png" : "image/jpeg"; // tentukan output thumb
      const thumbName = getThumbName(f.filename).replace(/\.(heic)$/i, ".jpg");
      const thumbPath = path.join(env.UPLOAD_DIR, "TPS", thumbName);

      try {
        await makeThumb(fullPath, thumbPath, mimeForThumb);
        f._thumbFilename = thumbName;
      } catch (err) {
        console.error("Gagal generate thumbnail:", f.filename, err);
        f._thumbFilename = null;
      }
    }

    const photosData = files.map((f, idx) => {
      const meta = fileMeta[idx] || {};
      // If takenAt provided, use it for backdate, otherwise use current time
      const taken = meta.takenAt ? new Date(meta.takenAt) : new Date();
      // Safety: normalize and validate category
      const allowed = ["before", "action", "after"];
      let cat = null;
      if (meta.category) {
        const c = String(meta.category).toLowerCase();
        cat = allowed.includes(c) ? c.toUpperCase() : null;
      }
      return {
        areaId,
        filename: f.filename,
        thumbFilename: f._thumbFilename ?? null,
        originalName: f.originalname || "",
        mime: f.mimetype,
        size: f.size,
        url: `/uploads/TPS/${f.filename}`,
        thumbUrl: f._thumbFilename ? `/uploads/TPS/${f._thumbFilename}` : null,
        takenAt: taken,
        keterangan: meta.keterangan || null,
        category: cat,
        comparisonGroupId: meta.comparisonGroupId
          ? Number(meta.comparisonGroupId)
          : null,
      };
    });

    // Use createMany for bulk insert but createMany doesn't return created rows.
    // We'll perform createMany for performance and then return count.
    try {
      const result = await prisma.photo.createMany({ data: photosData });
      return result;
    } catch (err) {
      // Rollback: delete files and thumbs written to disk
      for (const f of files) {
        try {
          const p = path.join(env.UPLOAD_DIR, "TPS", f.filename);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {
          console.warn("Failed cleanup file:", f.filename, e);
        }
        if (f._thumbFilename) {
          try {
            const tp = path.join(env.UPLOAD_DIR, f._thumbFilename);
            if (fs.existsSync(tp)) fs.unlinkSync(tp);
          } catch (e) {
            console.warn("Failed cleanup thumb:", f._thumbFilename, e);
          }
        }
      }
      throw err;
    }
  }

  static async list({
    areaId,
    period,
    date,
    page = 1,
    pageSize = 24,
    category,
    comparisonGroupId,
    groupByComparison = false,
  }) {
    const where = {};
    if (areaId) where.areaId = areaId;
    if (category) where.category = category.toUpperCase();
    if (comparisonGroupId) where.comparisonGroupId = Number(comparisonGroupId);
    if (period && !comparisonGroupId) {
      // only apply period filter when not querying by group (group should own its own dates)
      const { start, end } = getRange(date, period);
      where.createdAt = { gte: start, lte: end };
    }

    if (groupByComparison) {
      // Return grouped summary by comparisonGroupId
      const groups = await prisma.comparisonGroup.findMany({
        where: areaId ? { areaId } : {},
        include: {
          photos: { include: { area: true } },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      });
      const total = await prisma.comparisonGroup.count({
        where: areaId ? { areaId } : {},
      });
      return { total, items: groups, page, pageSize };
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

  // ComparisonGroup helpers
  static async createGroup({ title, areaId, description }) {
    return prisma.comparisonGroup.create({
      data: {
        title,
        areaId: areaId ? Number(areaId) : null,
        description: description || null,
      },
    });
  }

  static async updateGroup(id, data) {
    const payload = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (data.keterangan !== undefined) payload.keterangan = data.keterangan;
    if (data.summary !== undefined) payload.summary = data.summary;

    logger.debug("PhotoService.updateGroup payload", { payload });

    return prisma.comparisonGroup.update({
      where: { id: Number(id) },
      data: payload,
    });
  }

  static async listGroups({ areaId, page = 1, pageSize = 24 }) {
    const where = {};
    if (areaId) where.areaId = Number(areaId);
    const [total, groups] = await Promise.all([
      prisma.comparisonGroup.count({ where }),
      prisma.comparisonGroup.findMany({
        where,
        include: {
          photos: { orderBy: { createdAt: "desc" }, take: 10 },
          _count: { select: { photos: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Add completion status to each group
    const groupsWithStatus = groups.map((group) => {
      const photos = group.photos || [];
      const categories = {
        before: photos.filter((p) => p.category === "BEFORE").length,
        action: photos.filter((p) => p.category === "ACTION").length,
        after: photos.filter((p) => p.category === "AFTER").length,
      };

      const isComplete =
        categories.before > 0 && categories.action > 0 && categories.after > 0;

      return {
        ...group,
        categories,
        isComplete,
        canAddPhotos: !isComplete,
      };
    });

    return { total, items: groupsWithStatus, page, pageSize };
  }

  static async remove(id) {
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (photo) {
      const fullPath = path.join(env.UPLOAD_DIR, photo.filename);
      const thumbPath = photo.thumbFilename
        ? path.join(env.UPLOAD_DIR, photo.thumbFilename)
        : null;

      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) {
        console.error("Gagal hapus file asli:", err);
      }

      if (thumbPath) {
        try {
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        } catch (err) {
          console.error("Gagal hapus file thumb:", err);
        }
      }
    }
    return prisma.photo.delete({ where: { id } });
  }
}
