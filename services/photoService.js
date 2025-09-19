import { prisma } from "../utils/prisma.js";
import { getRange } from "../utils/dateRange.js";
import { env } from "../config/env.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";

function getThumbName(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return `${name}_thumb${ext}`;
}

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
  static async createMany({ areaId, files, publicBaseUrl, takenAt }) {
    const taken = takenAt ? new Date(takenAt) : undefined;

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
      const fullPath = path.join(env.UPLOAD_DIR, f.filename);
      const ext = path.extname(f.filename).toLowerCase();
      const mimeForThumb = ext === ".png" ? "image/png" : "image/jpeg"; // tentukan output thumb
      const thumbName = getThumbName(f.filename).replace(/\.(heic)$/i, ".jpg");
      const thumbPath = path.join(env.UPLOAD_DIR, thumbName);

      try {
        await makeThumb(fullPath, thumbPath, mimeForThumb);
        f._thumbFilename = thumbName;
      } catch (err) {
        console.error("Gagal generate thumbnail:", f.filename, err);
        f._thumbFilename = null;
      }
    }

    const photosData = files.map((f) => ({
      areaId,
      filename: f.filename,
      thumbFilename: f._thumbFilename ?? null,
      originalName: f.originalname || "",
      mime: f.mimetype,
      size: f.size,
      url: `${publicBaseUrl}/uploads/${f.filename}`,
      thumbUrl: f._thumbFilename
        ? `${publicBaseUrl}/uploads/${f._thumbFilename}`
        : null,

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
