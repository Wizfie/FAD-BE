import fs from "fs/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const dataPath =
  process.env.DATA_FAD_PATH || "c:/MyLocal/Data/DataFad/dataFad.json";

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const raw = await fs.readFile(dataPath, "utf8");
  const arr = JSON.parse(raw);
  // optional vendor file
  const vendorPath =
    process.env.DATA_VENDOR_PATH || "c:/MyLocal/Data/DataFad/dataVendor.json";
  let vendorFile = [];
  try {
    const vraw = await fs.readFile(vendorPath, "utf8");
    vendorFile = JSON.parse(vraw);
    console.log(
      `Loaded ${vendorFile.length} vendor records from ${vendorPath}`
    );
  } catch (e) {
    // vendor file optional
  }
  console.log(`Loaded ${arr.length} records from ${dataPath}`);

  // We'll upsert vendors and create fads with vendor relation.
  const vendorCache = new Map();

  let inserted = 0;
  for (const r of arr) {
    try {
      // upsert vendor
      const vendorName = (r.vendor || "").trim();
      let vendorId = null;
      if (vendorName) {
        if (vendorCache.has(vendorName)) {
          vendorId = vendorCache.get(vendorName);
        } else {
          // check vendor file for active flag
          const vendorMeta = vendorFile.find(
            (x) =>
              (x.name || x.vendor) && (x.name || x.vendor).trim() === vendorName
          );
          const createData = {
            name: vendorName,
            active: vendorMeta?.active ?? true,
          };
          const v = await prisma.vendor.upsert({
            where: { name: vendorName },
            update: { active: vendorMeta?.active ?? true },
            create: createData,
          });
          vendorId = v.id;
          vendorCache.set(vendorName, vendorId);
        }
      }

      // Build data:
      // - string fields => empty string if not provided
      // - date fields => null if not provided/invalid
      const data = {
        id: r.id || undefined,
        noFad: r.noFad ?? "",
        item: r.item ?? "",
        plant: r.plant ?? "",
        terimaFad: parseDate(r.terimaFad),
        terimaBbm: parseDate(r.terimaBbm),
        // snapshot of vendor name (keputusan desain: tetap simpan nama di Fad)
        vendor: r.vendor ?? "",
        // relasi ke tabel Vendor (nullable)
        vendorId: vendorId || null,
        status: r.status ?? "",
        deskripsi: r.deskripsi ?? "",
        keterangan: r.keterangan ?? "",
        bast: parseDate(r.bast),
      };

      // If id exists -> upsert, otherwise create
      if (data.id) {
        await prisma.fad.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        });
      } else {
        await prisma.fad.create({ data });
      }

      inserted++;
      if (inserted % 100 === 0)
        console.log(`Inserted/updated ${inserted} records`);
    } catch (e) {
      console.error("Error importing record", r.id || r.noFad, e.message ?? e);
    }
  }

  console.log(`Import finished, processed ${inserted} records`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
