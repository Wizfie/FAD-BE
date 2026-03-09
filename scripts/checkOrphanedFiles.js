/**
 * Script untuk check file yang tersisa di /uploads (tidak ada di database)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { prisma } from "../utils/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_BASE = path.resolve(__dirname, "../../uploads");

async function checkOrphanedFiles() {
  console.log("🔍 Checking for orphaned files in /uploads...\n");

  try {
    // Get all files in uploads root (not in subdirs)
    const filesInRoot = fs.readdirSync(UPLOAD_BASE).filter((file) => {
      const fullPath = path.join(UPLOAD_BASE, file);
      return fs.statSync(fullPath).isFile() && file !== "Thumbs.db";
    });

    console.log(`📁 Found ${filesInRoot.length} files in /uploads root\n`);

    // Get all filenames from database
    const photos = await prisma.photo.findMany({
      select: { filename: true, thumbFilename: true, id: true },
    });

    const programInfoImages = await prisma.programInfoImage.findMany({
      select: { filename: true, thumbFilename: true, id: true },
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

    console.log(`📊 Total unique filenames in database: ${dbFilenames.size}\n`);

    // Check which files are orphaned
    const orphanedFiles = [];
    const filesInDB = [];

    for (const file of filesInRoot) {
      if (dbFilenames.has(file)) {
        filesInDB.push(file);
      } else {
        orphanedFiles.push(file);
      }
    }

    console.log("=".repeat(60));
    console.log("📋 ANALYSIS RESULT");
    console.log("=".repeat(60));

    if (filesInDB.length > 0) {
      console.log(`\n⚠️  Files in DB but not moved (${filesInDB.length}):`);
      console.log("These files should have been moved to TPS subfolder!\n");
      filesInDB.forEach((file) => console.log(`   - ${file}`));

      console.log(
        "\n💡 These files need to be moved manually or re-run migration"
      );
    }

    if (orphanedFiles.length > 0) {
      console.log(
        `\n🗑️  Orphaned files (not in DB) (${orphanedFiles.length}):`
      );
      console.log("These files can be safely deleted:\n");
      orphanedFiles.forEach((file) => console.log(`   - ${file}`));

      console.log("\n💡 Run cleanup script to remove these files");
    }

    if (filesInDB.length === 0 && orphanedFiles.length === 0) {
      console.log("\n✅ All files properly migrated! /uploads root is clean.");
    }

    console.log("\n" + "=".repeat(60));
  } catch (error) {
    console.error("❌ Check failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphanedFiles().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
