/**
 * Script untuk memindahkan semua foto TPS dari /uploads ke /uploads/TPS
 * dan update database path
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { prisma } from "../utils/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_BASE = path.resolve(__dirname, "../../uploads");
const TPS_SUBFOLDER = path.join(UPLOAD_BASE, "TPS");

async function migratePhotos() {
  console.log("🚀 Starting photo migration to TPS subfolder...\n");

  try {
    // 1. Create TPS subfolder if not exists
    if (!fs.existsSync(TPS_SUBFOLDER)) {
      fs.mkdirSync(TPS_SUBFOLDER, { recursive: true });
      console.log("✅ Created TPS subfolder:", TPS_SUBFOLDER);
    } else {
      console.log("✅ TPS subfolder already exists");
    }

    // 2. Get all photos from database
    const photos = await prisma.photo.findMany({
      select: {
        id: true,
        url: true,
        thumbUrl: true,
        filename: true,
        thumbFilename: true,
      },
    });

    console.log(`\n📊 Found ${photos.length} photos in database\n`);

    let movedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // 3. Move each file and update database
    for (const photo of photos) {
      try {
        // Skip if already in TPS subfolder
        if (photo.url && photo.url.includes("/TPS/")) {
          skippedCount++;
          continue;
        }

        const updates = {};
        let filesToMove = [];

        // Handle main photo
        if (photo.filename) {
          const oldPath = path.join(UPLOAD_BASE, photo.filename);
          const newPath = path.join(TPS_SUBFOLDER, photo.filename);

          if (fs.existsSync(oldPath)) {
            filesToMove.push({ old: oldPath, new: newPath });
            updates.url = `/uploads/TPS/${photo.filename}`;
            updates.filename = photo.filename; // Keep filename same, just change path
          }
        }

        // Handle thumbnail
        if (photo.thumbFilename) {
          const oldThumbPath = path.join(UPLOAD_BASE, photo.thumbFilename);
          const newThumbPath = path.join(TPS_SUBFOLDER, photo.thumbFilename);

          if (fs.existsSync(oldThumbPath)) {
            filesToMove.push({ old: oldThumbPath, new: newThumbPath });
            updates.thumbUrl = `/uploads/TPS/${photo.thumbFilename}`;
            updates.thumbFilename = photo.thumbFilename;
          }
        }

        // Move files if any
        if (filesToMove.length > 0) {
          for (const file of filesToMove) {
            fs.renameSync(file.old, file.new);
          }
          movedCount += filesToMove.length;
        }

        // Update database if changes
        if (Object.keys(updates).length > 0) {
          await prisma.photo.update({
            where: { id: photo.id },
            data: updates,
          });
          updatedCount++;
          console.log(
            `✅ Moved & updated photo ID ${photo.id}: ${photo.filename}`
          );
        }
      } catch (err) {
        errors.push({ photoId: photo.id, error: err.message });
        console.error(`❌ Error processing photo ID ${photo.id}:`, err.message);
      }
    }

    // 4. Handle Program Info Images
    console.log("\n📸 Processing Program Info images...");
    const programInfoImages = await prisma.programInfoImage.findMany({
      select: {
        id: true,
        url: true,
        thumbUrl: true,
        filename: true,
        thumbFilename: true,
      },
    });

    console.log(`📊 Found ${programInfoImages.length} program info images\n`);

    for (const image of programInfoImages) {
      try {
        // Skip if already in TPS subfolder
        if (image.url && image.url.includes("/TPS/")) {
          skippedCount++;
          continue;
        }

        const updates = {};
        let filesToMove = [];

        // Handle main image
        if (image.filename) {
          const oldPath = path.join(UPLOAD_BASE, image.filename);
          const newPath = path.join(TPS_SUBFOLDER, image.filename);

          if (fs.existsSync(oldPath)) {
            filesToMove.push({ old: oldPath, new: newPath });
            updates.url = `/uploads/TPS/${image.filename}`;
            updates.filename = image.filename;
          }
        }

        // Handle thumbnail
        if (image.thumbFilename) {
          const oldThumbPath = path.join(UPLOAD_BASE, image.thumbFilename);
          const newThumbPath = path.join(TPS_SUBFOLDER, image.thumbFilename);

          if (fs.existsSync(oldThumbPath)) {
            filesToMove.push({ old: oldThumbPath, new: newThumbPath });
            updates.thumbUrl = `/uploads/TPS/${image.thumbFilename}`;
            updates.thumbFilename = image.thumbFilename;
          }
        }

        // Move files if any
        if (filesToMove.length > 0) {
          for (const file of filesToMove) {
            fs.renameSync(file.old, file.new);
          }
          movedCount += filesToMove.length;
        }

        // Update database if changes
        if (Object.keys(updates).length > 0) {
          await prisma.programInfoImage.update({
            where: { id: image.id },
            data: updates,
          });
          updatedCount++;
          console.log(
            `✅ Moved & updated program info image ID ${image.id}: ${image.filename}`
          );
        }
      } catch (err) {
        errors.push({ imageId: image.id, error: err.message });
        console.error(
          `❌ Error processing program info image ID ${image.id}:`,
          err.message
        );
      }
    }

    // 5. Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Files moved: ${movedCount}`);
    console.log(`✅ Database records updated: ${updatedCount}`);
    console.log(`⏭️  Records skipped (already migrated): ${skippedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n❌ Errors details:");
      errors.forEach((err) =>
        console.log(
          `   - Photo/Image ${err.photoId || err.imageId}: ${err.error}`
        )
      );
    }

    console.log("\n✅ Migration completed!");
    console.log("\n💡 Next steps:");
    console.log("   1. Verify photos are accessible in the app");
    console.log("   2. Update UPLOAD_DIR in .env if needed");
    console.log(
      "   3. Update photoService.js to use TPS subfolder for new uploads"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePhotos().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
