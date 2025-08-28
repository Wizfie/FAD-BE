import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  parseDate,
  startOfDay,
  tryParseDate,
  tryParseMonth,
} from "../utils/formatedDate.js";

dotenv.config();

const prisma = new PrismaClient();

// Fad: menggunakan Prisma MySQL
const saveDataFad = async (formData) => {
  try {
    const data = {
      id: formData.id || undefined,
      noFad: formData.noFad || null,
      item: formData.item || null,
      plant: formData.plant || null,
      terimaFad: parseDate(formData.terimaFad),
      terimaBbm: parseDate(formData.terimaBbm),
      vendor: formData.vendor || null,
      status: formData.status || null,
      deskripsi: formData.deskripsi || null,
      keterangan: formData.keterangan || null,
      bast: parseDate(formData.bast),
    };

    const created = await prisma.fad.create({ data });
    return created;
  } catch (e) {
    console.error("Gagal menyimpan data ke DB", e);
    throw e;
  }
};

// Membaca data dari database dengan support search + pagination + DATE search
const readDataFad = async (options = {}) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 50,
      fields = undefined,
      status = undefined,
    } = options;

    const q = String(search || "").trim();
    if (q) console.log("[readDataFad] search:", q);

    const allowedFields = new Set([
      "noFad",
      "item",
      "plant",
      "terimaFad",
      "terimaBbm",
      "bast",
      "vendor",
      "status",
      "deskripsi",
      "keterangan",
      "vendorRel.name",
      "createdAt",
    ]);
    const dateFields = ["terimaFad", "terimaBbm", "bast"];

    const requested = Array.isArray(fields) && fields.length ? fields : null;

    const orClauses = [];

    if (q) {
      // 1) Coba treat q sebagai TANGGAL / BULAN
      const asDate = tryParseDate(q);
      const asMonth = tryParseMonth(q);

      if (asDate) {
        const gte = startOfDay(asDate);
        const lte = endOfDay(asDate);
        dateFields.forEach((df) => {
          if (!requested || requested.includes(df)) {
            orClauses.push({ [df]: { gte, lte } });
          }
        });
      } else if (asMonth) {
        const { start, end } = asMonth;
        dateFields.forEach((df) => {
          if (!requested || requested.includes(df)) {
            orClauses.push({ [df]: { gte: start, lte: end } });
          }
        });
      }

      // 2) Tambahkan pencarian TEXT (contains) seperti semula
      const addForField = (f) => {
        if (f === "vendorRel.name") {
          orClauses.push({ vendorRel: { name: { contains: q } } });
        } else if (allowedFields.has(f)) {
          // untuk field DATE: kalau user ketik string non-tanggal, abaikan contains pada DATE
          if (dateFields.includes(f)) return;
          orClauses.push({ [f]: { contains: q } });
        }
      };

      if (requested) {
        requested.forEach((f) => addForField(f));
      } else {
        [
          "noFad",
          "item",
          "plant",
          "vendor",
          "vendorRel.name",
          "status",
          "deskripsi",
          "keterangan",
        ].forEach((f) => addForField(f));
      }
    }

    // Gabungkan dengan filter status (opsional)
    let where = {};
    if (status) {
      const s = String(status).trim();
      // support comma-separated list: e.g. "open,hold"
      const parts = s
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      let statusFilter;
      if (parts.length > 1) {
        // build OR of contains for each requested status
        statusFilter = { OR: parts.map((p) => ({ status: { contains: p } })) };
      } else {
        statusFilter = { status: { contains: parts[0] } };
      }
      if (orClauses.length) {
        where = { AND: [{ OR: orClauses }, statusFilter] };
      } else {
        where = statusFilter;
      }
    } else if (orClauses.length) {
      where = { OR: orClauses };
    }

    const skip = Math.max(0, (Number(page) - 1) * Number(limit));
    const take = Number(limit) || 50;

    const [total, rows] = await Promise.all([
      prisma.fad.count({ where }),
      prisma.fad.findMany({
        where,
        include: { vendorRel: true },
        skip,
        take,
        // order by creation time so newest records appear first regardless of UUID
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const normalized = rows.map((f) => ({
      ...f,
      noFad: f.noFad ?? "",
      item: f.item ?? "",
      plant: f.plant ?? "",
      vendor: f.vendor ?? "",
      status: f.status ?? "",
      deskripsi: f.deskripsi ?? "",
      keterangan: f.keterangan ?? "",
      vendorRel: f.vendorRel ?? null,
      createdAt: f.createdAt ?? null,
    }));

    return {
      data: normalized,
      meta: { total, page: Number(page), limit: Number(limit) },
    };
  } catch (e) {
    console.error("Gagal membaca data dari DB", e);
    throw e;
  }
};

// Memperbarui data berdasarkan ID (DB)
const updateDataFad = async (id, updatedData) => {
  try {
    const data = {};
    if (updatedData.noFad !== undefined) data.noFad = updatedData.noFad;
    if (updatedData.item !== undefined) data.item = updatedData.item;
    if (updatedData.plant !== undefined) data.plant = updatedData.plant;
    if (updatedData.terimaFad !== undefined)
      data.terimaFad = parseDate(updatedData.terimaFad);
    if (updatedData.terimaBbm !== undefined)
      data.terimaBbm = parseDate(updatedData.terimaBbm);
    if (updatedData.vendor !== undefined) data.vendor = updatedData.vendor;
    if (updatedData.status !== undefined) data.status = updatedData.status;
    if (updatedData.deskripsi !== undefined)
      data.deskripsi = updatedData.deskripsi;
    if (updatedData.keterangan !== undefined)
      data.keterangan = updatedData.keterangan;
    if (updatedData.bast !== undefined) data.bast = parseDate(updatedData.bast);

    const updated = await prisma.fad.update({ where: { id }, data });
    return { message: "Data berhasil diperbarui", data: updated };
  } catch (e) {
    console.error("Gagal memperbarui data di DB", e);
    throw new Error("Gagal memperbarui data");
  }
};

// Menghapus data berdasarkan ID (DB)
const deleteDataFad = async (id) => {
  try {
    const deleted = await prisma.fad.delete({ where: { id } });
    return { message: "Data berhasil dihapus", data: deleted };
  } catch (e) {
    console.error("Gagal menghapus data di DB", e);
    throw new Error("Gagal menghapus data");
  }
};

// Vendor operations using Prisma
const saveDataVendor = async (formData) => {
  try {
    const v = await prisma.vendor.create({
      data: { name: formData.name, active: formData.active ?? true },
    });
    return v;
  } catch (e) {
    console.error("Gagal menyimpan vendor", e);
    throw e;
  }
};

const readDataVendor = async () => {
  try {
    const list = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
    return list;
  } catch (e) {
    console.error("Gagal membaca vendor", e);
    throw e;
  }
};

const updateDataVendor = async (id, updatedData) => {
  try {
    const data = {};
    if (updatedData.name !== undefined) data.name = updatedData.name;
    if (updatedData.active !== undefined) data.active = updatedData.active;
    const updated = await prisma.vendor.update({ where: { id }, data });
    return { message: "Data vendor berhasil diperbarui", data: updated };
  } catch (e) {
    console.error("Gagal memperbarui data vendor", e);
    throw new Error("Gagal memperbarui data vendor");
  }
};

const deleteDataVendor = async (id) => {
  try {
    const deleted = await prisma.vendor.delete({ where: { id } });
    return { message: "Data vendor berhasil dihapus", data: deleted };
  } catch (e) {
    console.error("Gagal menghapus data vendor", e);
    throw new Error("Gagal menghapus data vendor");
  }
};

// Utility: shutdown prisma client
const shutdownPrisma = async () => {
  try {
    await prisma.$disconnect();
    console.log("Prisma client disconnected");
  } catch (e) {
    console.error("Error disconnecting prisma", e);
  }
};

export {
  saveDataFad,
  readDataFad,
  updateDataFad,
  deleteDataFad,
  saveDataVendor,
  readDataVendor,
  updateDataVendor,
  deleteDataVendor,
  shutdownPrisma,
};
