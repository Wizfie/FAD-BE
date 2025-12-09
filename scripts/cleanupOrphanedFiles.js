/**
 * Script untuk cleanup orphaned files dari /uploads root
 * File yang tidak ada record-nya di database akan dipindahkan ke folder backup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { prisma } from "../utils/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_BASE = path.resolve(__dirname, "../../uploads");
const BACKUP_FOLDER = path.join(UPLOAD_BASE, "_orphaned_backup");

async function cleanupOrphanedFiles() {
  console.log("🧹 Starting cleanup of orphaned files...\n");

  try {
    // Create backup folder
    if (!fs.existsSync(BACKUP_FOLDER)) {
      fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
      console.log("✅ Created backup folder:", BACKUP_FOLDER);
    }

    // Get all files in uploads root
    const filesInRoot = fs.readdirSync(UPLOAD_BASE).filter((file) => {
      const fullPath = path.join(UPLOAD_BASE, file);
      return fs.statSync(fullPath).isFile() && file !== "Thumbs.db";
    });

    console.log(`📁 Found ${filesInRoot.length} files in /uploads root\n`);

    // Get all filenames from database
    const photos = await prisma.photo.findMany({
      select: { filename: true, thumbFilename: true },
    });

    const programInfoImages = await prisma.programInfoImage.findMany({
      select: { filename: true, thumbFilename: true },
    });

    const dbFilenames = new Set();

    photos.forEach((p) => {
      if (p.filename) dbFilenames.add(p.filename);
      if (p.thumbFilename) dbFilenames.add(p.thumbFilename);
    });

    programInfoImages.forEach((img) => {
      if (img.filename) dbFilenames.add(img.filename);
      if (img.thumbFilename) dbFilenames.add(img.thumbFilename);
    });

    // Move orphaned files to backup
    let movedCount = 0;
    let skippedCount = 0;

    for (const file of filesInRoot) {
      if (!dbFilenames.has(file)) {
        const sourcePath = path.join(UPLOAD_BASE, file);
        const backupPath = path.join(BACKUP_FOLDER, file);

        try {
          fs.renameSync(sourcePath, backupPath);
          console.log(`✅ Moved to backup: ${file}`);
          movedCount++;
        } catch (err) {
          console.error(`❌ Failed to move: ${file}`, err.message);
        }
      } else {
        skippedCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 CLEANUP SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Files moved to backup: ${movedCount}`);
    console.log(`⏭️  Files kept (in database): ${skippedCount}`);
    console.log(`\n📂 Backup location: ${BACKUP_FOLDER}`);
    console.log(
      "\n💡 If you're sure you don't need these files, you can delete the backup folder."
    );
    console.log("   Otherwise, keep it for a few days before deleting.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedFiles().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
