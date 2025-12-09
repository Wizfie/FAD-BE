/**
 * Script untuk menghapus base URL dari field url dan thumbUrl di tabel Photo dan ProgramInfoImage
 * Mengubah: http://localhost:5001/uploads/xxx.jpg
 * Menjadi: /uploads/xxx.jpg
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function removeBaseUrlFromPhotos() {
  console.log("🔍 Memulai proses update...");

  try {
    // 1. Update tabel Photo
    console.log("\n📸 Mengupdate tabel Photo...");
    const photos = await prisma.photo.findMany({
      select: { id: true, url: true, thumbUrl: true },
    });

    let photoUpdateCount = 0;
    for (const photo of photos) {
      const updates = {};

      // Update url jika mengandung base URL
      if (
        photo.url &&
        (photo.url.startsWith("http://") || photo.url.startsWith("https://"))
      ) {
        // Ekstrak path setelah domain
        const urlMatch = photo.url.match(/\/uploads\/.+$/);
        if (urlMatch) {
          updates.url = urlMatch[0];
        }
      }

      // Update thumbUrl jika mengandung base URL
      if (
        photo.thumbUrl &&
        (photo.thumbUrl.startsWith("http://") ||
          photo.thumbUrl.startsWith("https://"))
      ) {
        const thumbMatch = photo.thumbUrl.match(/\/uploads\/.+$/);
        if (thumbMatch) {
          updates.thumbUrl = thumbMatch[0];
        }
      }

      // Lakukan update jika ada perubahan
      if (Object.keys(updates).length > 0) {
        await prisma.photo.update({
          where: { id: photo.id },
          data: updates,
        });
        photoUpdateCount++;
        console.log(`  ✅ Photo ID ${photo.id} updated`);
      }
    }

    console.log(
      `✨ Total ${photoUpdateCount} foto berhasil diupdate dari ${photos.length} foto`
    );

    // 2. Update tabel ProgramInfoImage
    console.log("\n🖼️  Mengupdate tabel ProgramInfoImage...");
    const programImages = await prisma.programInfoImage.findMany({
      select: { id: true, url: true, thumbUrl: true },
    });

    let programImageUpdateCount = 0;
    for (const image of programImages) {
      const updates = {};

      // Update url jika mengandung base URL
      if (
        image.url &&
        (image.url.startsWith("http://") || image.url.startsWith("https://"))
      ) {
        const urlMatch = image.url.match(/\/uploads\/.+$/);
        if (urlMatch) {
          updates.url = urlMatch[0];
        }
      }

      // Update thumbUrl jika mengandung base URL
      if (
        image.thumbUrl &&
        (image.thumbUrl.startsWith("http://") ||
          image.thumbUrl.startsWith("https://"))
      ) {
        const thumbMatch = image.thumbUrl.match(/\/uploads\/.+$/);
        if (thumbMatch) {
          updates.thumbUrl = thumbMatch[0];
        }
      }

      // Lakukan update jika ada perubahan
      if (Object.keys(updates).length > 0) {
        await prisma.programInfoImage.update({
          where: { id: image.id },
          data: updates,
        });
        programImageUpdateCount++;
        console.log(`  ✅ ProgramInfoImage ID ${image.id} updated`);
      }
    }

    console.log(
      `✨ Total ${programImageUpdateCount} program info image berhasil diupdate dari ${programImages.length} gambar`
    );

    console.log("\n🎉 Proses update selesai!");
    console.log(`📊 Ringkasan:`);
    console.log(`   - Photo: ${photoUpdateCount}/${photos.length} diupdate`);
    console.log(
      `   - ProgramInfoImage: ${programImageUpdateCount}/${programImages.length} diupdate`
    );
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan script
removeBaseUrlFromPhotos().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
