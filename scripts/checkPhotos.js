import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkPhotos() {
  try {
    const photos = await prisma.photo.findMany({
      take: 5,
      select: { id: true, url: true, thumbUrl: true },
    });
    console.log("Sample Photos:");
    photos.forEach((p) => {
      console.log(`  ID: ${p.id}`);
      console.log(`  URL: ${p.url}`);
      console.log(`  ThumbURL: ${p.thumbUrl}`);
      console.log("---");
    });

    const programImages = await prisma.programInfoImage.findMany({
      take: 5,
      select: { id: true, url: true, thumbUrl: true },
    });
    console.log("\nSample Program Images:");
    programImages.forEach((p) => {
      console.log(`  ID: ${p.id}`);
      console.log(`  URL: ${p.url}`);
      console.log(`  ThumbURL: ${p.thumbUrl}`);
      console.log("---");
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotos();
