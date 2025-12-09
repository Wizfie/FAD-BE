import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkPhotoDetails() {
  try {
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: [11, 12, 13, 28, 29] },
      },
      select: {
        id: true,
        filename: true,
        url: true,
        createdAt: true,
        area: { select: { name: true } },
      },
    });

    console.log("Photo Details:");
    photos.forEach((p) => {
      console.log(
        `ID: ${p.id}, Area: ${p.area?.name || "N/A"}, Created: ${p.createdAt}`
      );
      console.log(`  Filename: ${p.filename}`);
      console.log(`  URL: ${p.url}`);
    });

    // Check if files exist
    console.log("\nFile Existence Check:");
    const fs = await import("fs");
    const path = await import("path");
    const uploadDir = "C:\\MyLocal\\Project\\FAD-grm\\uploads";

    photos.forEach((p) => {
      const filePath = path.join(uploadDir, p.filename);
      const exists = fs.existsSync(filePath);
      console.log(`  ${p.filename}: ${exists ? "✅ EXISTS" : "❌ MISSING"}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotoDetails();
