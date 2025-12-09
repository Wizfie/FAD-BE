/**
 * ProgramInfoController - Mengelola upload dan data gambar Program 5R
 */
import { ProgramInfoService } from "../services/programInfoService.js";
import { prisma } from "../utils/prisma.js";
import { changeLog } from "./changeLogController.js";
import { logger } from "../utils/logger.js";

export class ProgramInfoController {
  /**
   * Get all program info images
   */
  static async getAll(req, res) {
    try {
      logger.request(req, "📋 Get program info images");

      const images = await prisma.programInfoImage.findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });

      logger.info("Program info images retrieved", {
        count: images.length,
      });

      res.json({
        success: true,
        data: images,
      });
    } catch (error) {
      logger.error("Failed to get program info images", error);
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data gambar program 5R",
      });
    }
  }

  /**
   * Upload program info image (admin only)
   */
  static async upload(req, res) {
    try {
      logger.request(req, "📥 Upload program info image");

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File gambar wajib diupload",
        });
      }

      const { title, displayOrder } = req.body;

      const result = await ProgramInfoService.uploadImage(
        req.file,
        title,
        displayOrder ? parseInt(displayOrder) : undefined
      );

      // Log change
      await changeLog("ProgramInfoImage", "CREATE", result);

      logger.info("Program info image uploaded", {
        id: result.id,
        filename: result.filename,
      });

      res.json({
        success: true,
        message: "Gambar program 5R berhasil diupload",
        data: result,
      });
    } catch (error) {
      logger.error("Failed to upload program info image", error);
      res.status(500).json({
        success: false,
        message: error.message || "Gagal mengupload gambar program 5R",
      });
    }
  }

  /**
   * Delete program info image (admin only)
   */
  static async remove(req, res) {
    try {
      logger.request(req, "🗑️ Delete program info image");

      const { id } = req.params;
      const imageId = parseInt(id);

      if (!imageId) {
        return res.status(400).json({
          success: false,
          message: "ID gambar tidak valid",
        });
      }

      // Get image data before deletion for logging
      const existingImage = await prisma.programInfoImage.findUnique({
        where: { id: imageId },
      });

      if (!existingImage) {
        return res.status(404).json({
          success: false,
          message: "Gambar tidak ditemukan",
        });
      }

      await ProgramInfoService.deleteImage(imageId);

      // Log change
      await changeLog("ProgramInfoImage", "DELETE", existingImage);

      logger.info("Program info image deleted", {
        id: imageId,
        filename: existingImage.filename,
      });

      res.json({
        success: true,
        message: "Gambar program 5R berhasil dihapus",
      });
    } catch (error) {
      logger.error("Failed to delete program info image", error);
      res.status(500).json({
        success: false,
        message: error.message || "Gagal menghapus gambar program 5R",
      });
    }
  }

  /**
   * Update single program info image (admin only)
   */
  static async update(req, res) {
    try {
      logger.request(req, "✏️ Update program info image");

      const { id } = req.params;
      const imageId = parseInt(id);

      if (!imageId) {
        return res.status(400).json({
          success: false,
          message: "ID gambar tidak valid",
        });
      }

      const { title, displayOrder } = req.body;

      // Check if image exists
      const existingImage = await prisma.programInfoImage.findUnique({
        where: { id: imageId },
      });

      if (!existingImage) {
        return res.status(404).json({
          success: false,
          message: "Gambar tidak ditemukan",
        });
      }

      // Prepare update data
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (displayOrder !== undefined)
        updateData.displayOrder = parseInt(displayOrder);

      // Update image
      const updatedImage = await prisma.programInfoImage.update({
        where: { id: imageId },
        data: updateData,
      });

      // Log change
      await changeLog("ProgramInfoImage", "UPDATE", {
        id: imageId,
        changes: updateData,
      });

      logger.info("Program info image updated", {
        id: imageId,
        changes: updateData,
      });

      res.json({
        success: true,
        message: "Gambar program 5R berhasil diperbarui",
        data: updatedImage,
      });
    } catch (error) {
      logger.error("Failed to update program info image", error);
      res.status(500).json({
        success: false,
        message: error.message || "Gagal memperbarui gambar program 5R",
      });
    }
  }

  /**
   * Update display order of program info images (admin only)
   */
  static async updateOrder(req, res) {
    try {
      logger.request(req, "🔄 Update program info images order");

      const { imageOrders } = req.body; // Array of {id, displayOrder}

      if (!Array.isArray(imageOrders)) {
        return res.status(400).json({
          success: false,
          message: "Format data urutan tidak valid",
        });
      }

      await ProgramInfoService.updateDisplayOrder(imageOrders);

      // Log change
      await changeLog("ProgramInfoImage", "UPDATE_ORDER", imageOrders);

      logger.info("Program info images order updated", {
        count: imageOrders.length,
      });

      res.json({
        success: true,
        message: "Urutan gambar program 5R berhasil diperbarui",
      });
    } catch (error) {
      logger.error("Failed to update program info images order", error);
      res.status(500).json({
        success: false,
        message: error.message || "Gagal memperbarui urutan gambar program 5R",
      });
    }
  }
}
