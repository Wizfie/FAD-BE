/**
 * scripts/regenThumbs.js
 *
 * Regenerasi thumbnail untuk foto yang:
 *   a) thumbFilename NULL di DB, ATAU
 *   b) thumbFilename ada di DB tapi file-nya tidak ada di disk
 *
 * Jalankan manual:
 *   node scripts/regenThumbs.js
 *
 * Opsi:
 *   --all   → regenerasi semua foto (termasuk yang thumb-nya sudah ada)
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const { config } = await import("dotenv");
  config({ path: path.resolve(__dirname, "../.env") });
} catch {}

const { prisma } = await import("../utils/prisma.js");
const { env } = await import("../config/env.js");

const FORCE_ALL = process.argv.includes("--all");
const UPLOAD_TPS = path.join(env.UPLOAD_DIR, "TPS");

function getThumbName(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return `${name}_thumb${ext}`;
}

async function makeThumb(fullPath, thumbPath, mime) {
  let img = sharp(fullPath).rotate();
  if (/png/i.test(mime)) {
    await img
      .resize({ width: 320 })
      .png({ compressionLevel: 8 })
      .toFile(thumbPath);
  } else {
    await img.resize({ width: 320 }).jpeg({ quality: 70 }).toFile(thumbPath);
  }
}

async function main() {
  console.log(
    `\n🔍 Mode: ${FORCE_ALL ? "regenerasi SEMUA foto" : "hanya foto tanpa thumb"}\n`,
  );

  const photos = await prisma.photo.findMany({
    select: { id: true, filename: true, thumbFilename: true, mime: true },
  });

  let total = 0,
    skipped = 0,
    success = 0,
    failed = 0;

  for (const photo of photos) {
    total++;
    const originalPath = path.join(UPLOAD_TPS, photo.filename);

    // Skip jika file original tidak ada di disk
    if (!fs.existsSync(originalPath)) {
      console.warn(`  ⚠ Original tidak ada di disk, skip: ${photo.filename}`);
      skipped++;
      continue;
    }

    const expectedThumbName = getThumbName(photo.filename);
    const thumbPath = path.join(UPLOAD_TPS, expectedThumbName);
    const thumbExistsOnDisk = fs.existsSync(thumbPath);
    const thumbUpToDateInDb = photo.thumbFilename === expectedThumbName;

    // Tentukan apakah perlu di-generate
    const needsRegen = FORCE_ALL || !thumbExistsOnDisk || !thumbUpToDateInDb;

    if (!needsRegen) {
      skipped++;
      continue;
    }

    try {
      await makeThumb(originalPath, thumbPath, photo.mime || "image/jpeg");

      // Update DB jika thumbFilename berubah atau NULL
      if (photo.thumbFilename !== expectedThumbName) {
        await prisma.photo.update({
          where: { id: photo.id },
          data: {
            thumbFilename: expectedThumbName,
            thumbUrl: `/uploads/TPS/${expectedThumbName}`,
          },
        });
      }

      console.log(`  ✅ ${photo.filename} → ${expectedThumbName}`);
      success++;
    } catch (err) {
      console.error(`  ❌ Gagal: ${photo.filename} — ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n📊 Selesai: ${total} total, ${success} di-generate, ${skipped} di-skip, ${failed} gagal\n`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
