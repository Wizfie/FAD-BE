/**
 * ProgramInfoService - Service untuk mengelola gambar Program 5R
 */
import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";

/**
 * Generate nama file dengan prefix info_
 */
function generateInfoFilename(originalName) {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, "_");
  return `info_${timestamp}_${cleanBaseName}${ext}`;
}

/**
 * Dapatkan nama thumbnail dari filename
 */
function getThumbName(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return `${name}_thumb${ext}`;
}

/**
 * Buat thumbnail dari gambar
 */
async function makeThumb(fullPath, thumbPath, mime) {
  let img = sharp(fullPath).rotate();

  if (mime === "image/jpeg") {
    await img.resize({ width: 320 }).jpeg({ quality: 70 }).toFile(thumbPath);
  } else if (mime === "image/png") {
    await img.resize({ width: 320 }).png().toFile(thumbPath);
  } else if (mime === "image/webp") {
    await img.resize({ width: 320 }).webp().toFile(thumbPath);
  } else {
    // Default: convert to JPEG thumbnail
    await img.resize({ width: 320 }).jpeg({ quality: 70 }).toFile(thumbPath);
  }
}

export class ProgramInfoService {
  /**
   * Konversi file HEIC ke JPEG
   */
  static async convertHeicToJpeg(file) {
    const srcPath = path.join(env.UPLOAD_DIR, "TPS", file.filename);
    const dstName = file.filename.replace(/\.heic$/i, ".jpg");
    const dstPath = path.join(env.UPLOAD_DIR, "TPS", dstName);

    await sharp(srcPath).jpeg({ quality: 80 }).toFile(dstPath);

    try {
      fs.unlinkSync(srcPath); // hapus HEIC asli
    } catch (err) {
      logger.warn("Failed to delete HEIC file", { filename: file.filename });
    }

    // Update metadata
    file.filename = dstName;
    file.mimetype = "image/jpeg";
    file.originalname = file.originalname.replace(/\.heic$/i, ".jpg");
  }

  /**
   * Upload gambar program info
   */
  static async uploadImage(file, title = null, displayOrder = 0) {
    try {
      // Convert HEIC to JPEG if needed
      if (
        file.mimetype === "image/heic" ||
        file.originalname.toLowerCase().endsWith(".heic")
      ) {
        await this.convertHeicToJpeg(file);
      }

      // Generate filename dengan prefix info_
      const newFilename = generateInfoFilename(file.originalname);
      const oldPath = path.join(env.UPLOAD_DIR, "TPS", file.filename);
      const newPath = path.join(env.UPLOAD_DIR, "TPS", newFilename);

      // Rename file dengan prefix info_
      fs.renameSync(oldPath, newPath);

      // Buat thumbnail
      const thumbFilename = getThumbName(newFilename);
      const thumbPath = path.join(env.UPLOAD_DIR, "TPS", thumbFilename);

      await makeThumb(newPath, thumbPath, file.mimetype);

      // Generate URLs (path relatif tanpa base URL)
      const url = `/uploads/TPS/${newFilename}`;
      const thumbUrl = `/uploads/TPS/${thumbFilename}`;

      // Get next display order if not provided
      if (!displayOrder) {
        const maxOrder = await prisma.programInfoImage.aggregate({
          _max: { displayOrder: true },
        });
        displayOrder = (maxOrder._max.displayOrder || 0) + 1;
      }

      // Simpan ke database
      const result = await prisma.programInfoImage.create({
        data: {
          title: title || null,
          filename: newFilename,
          thumbFilename,
          thumbUrl,
          originalName: file.originalname,
          mime: file.mimetype,
          size: file.size,
          url,
          displayOrder,
        },
      });

      logger.info("Program info image uploaded", {
        id: result.id,
        filename: newFilename,
        originalName: file.originalname,
        displayOrder,
      });

      return result;
    } catch (error) {
      logger.error("Failed to upload program info image", error);
      throw new Error("Gagal mengupload gambar program 5R");
    }
  }

  /**
   * Delete gambar program info
   */
  static async deleteImage(imageId) {
    try {
      // Get image data
      const image = await prisma.programInfoImage.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        throw new Error("Gambar tidak ditemukan");
      }

      // Delete files from storage
      const imagePath = path.join(env.UPLOAD_DIR, "TPS", image.filename);
      const thumbPath = path.join(env.UPLOAD_DIR, "TPS", image.thumbFilename);

      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      } catch (fileError) {
        logger.warn("Failed to delete physical files", {
          imageId,
          filename: image.filename,
          error: fileError.message,
        });
      }

      // Delete from database
      await prisma.programInfoImage.delete({
        where: { id: imageId },
      });

      logger.info("Program info image deleted", {
        id: imageId,
        filename: image.filename,
      });

      return true;
    } catch (error) {
      logger.error("Failed to delete program info image", error);
      throw new Error(error.message || "Gagal menghapus gambar program 5R");
    }
  }

  /**
   * Update display order of images
   */
  static async updateDisplayOrder(imageOrders) {
    try {
      // Use transaction to update all orders atomically
      await prisma.$transaction(
        imageOrders.map(({ id, displayOrder }) =>
          prisma.programInfoImage.update({
            where: { id: parseInt(id) },
            data: { displayOrder: parseInt(displayOrder) },
          })
        )
      );

      logger.info("Program info images display order updated", {
        count: imageOrders.length,
      });

      return true;
    } catch (error) {
      logger.error("Failed to update program info images order", error);
      throw new Error("Gagal memperbarui urutan gambar program 5R");
    }
  }

  /**
   * Get all program info images
   */
  static async getAllImages() {
    try {
      const images = await prisma.programInfoImage.findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });

      return images;
    } catch (error) {
      logger.error("Failed to get program info images", error);
      throw new Error("Gagal mengambil data gambar program 5R");
    }
  }
}
