import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  parseDate,
  startOfDay,
  tryParseDate,
  tryParseMonth,
} from "../utils/formatedDate.js";
import { logger } from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

dotenv.config();

const prisma = new PrismaClient();

/**
 * Simpan data FAD menggunakan Prisma MySQL
 */
const saveDataFad = async (formData) => {
  try {
    const data = {
      id: formData.id || undefined,
      noFad: formData.noFad || null,
      item: formData.item || null,
      plant: formData.plant || null,
      terimaFad: parseDate(formData.terimaFad),
      terimaBbm: parseDate(formData.terimaBbm),
      tglAngkut: parseDate(formData.tglAngkut),
      vendorId: formData.vendorId || null,
      status: formData.status || null,
      deskripsi: formData.deskripsi || null,
      keterangan: formData.keterangan || null,
      bast: parseDate(formData.bast),
    };

    // If vendorId is provided, get vendor name and set it
    if (formData.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: formData.vendorId },
      });
      if (vendor) {
        data.vendor = vendor.name;
      }
    }

    const created = await prisma.fad.create({ data });
    return created;
  } catch (e) {
    console.error("Gagal menyimpan data ke DB", e);
    throw e;
  }
};

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
    if (q) logger.debug("[readDataFad] search", { query: q });

    const allowedFields = new Set([
      "noFad",
      "item",
      "plant",
      "terimaFad",
      "terimaBbm",
      "bast",
      "tglAngkut",
      "vendor",
      "status",
      "deskripsi",
      "keterangan",
      "vendorRel.name",
      "createdAt",
    ]);
    const dateFields = ["terimaFad", "terimaBbm", "bast", "tglAngkut"];

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
      terimaFad: f.terimaFad ?? null,
      terimaBbm: f.terimaBbm ?? null,
      bast: f.bast ?? null,
      tglAngkut: f.tglAngkut ?? null,
      vendor: f.vendor ?? "",
      vendorId: f.vendorId ?? null,
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

const updateDataFad = async (id, updatedData) => {
  try {
    console.log("🔧 [updateDataFad] Starting update for ID:", id);
    console.log(
      "🔧 [updateDataFad] Received data:",
      JSON.stringify(updatedData, null, 2)
    );

    const existingRecord = await prisma.fad.findUnique({
      where: { id },
      include: { vendorRel: true },
    });

    if (!existingRecord) {
      console.error("❌ [updateDataFad] Record not found for ID:", id);
      throw ApiError.notFound(`Data FAD dengan ID ${id} tidak ditemukan`, {
        id,
      });
    }

    console.log(
      "✅ [updateDataFad] Found existing record:",
      existingRecord.noFad
    );

    // Create "before" snapshot
    const beforeData = {
      id: existingRecord.id,
      noFad: existingRecord.noFad,
      item: existingRecord.item,
      plant: existingRecord.plant,
      terimaFad: existingRecord.terimaFad,
      terimaBbm: existingRecord.terimaBbm,
      bast: existingRecord.bast,
      tglAngkut: existingRecord.tglAngkut,
      vendorId: existingRecord.vendorId,
      vendor: existingRecord.vendor,
      status: existingRecord.status,
      deskripsi: existingRecord.deskripsi,
      keterangan: existingRecord.keterangan,
      vendorRel: existingRecord.vendorRel,
    };

    const data = {};
    const changes = {}; // Track field changes for changelog

    // Handle string fields with change tracking
    if (
      updatedData.noFad !== undefined &&
      updatedData.noFad !== existingRecord.noFad
    ) {
      const newValue = updatedData.noFad || null;
      data.noFad = newValue;
      changes.noFad = { from: existingRecord.noFad, to: newValue };
    }
    if (
      updatedData.item !== undefined &&
      updatedData.item !== existingRecord.item
    ) {
      const newValue = updatedData.item || null;
      data.item = newValue;
      changes.item = { from: existingRecord.item, to: newValue };
    }
    if (
      updatedData.plant !== undefined &&
      updatedData.plant !== existingRecord.plant
    ) {
      const newValue = updatedData.plant || null;
      data.plant = newValue;
      changes.plant = { from: existingRecord.plant, to: newValue };
    }

    // Handle date parsing with change tracking
    if (updatedData.terimaFad !== undefined) {
      console.log(
        "📅 [updateDataFad] Parsing terimaFad:",
        updatedData.terimaFad
      );
      let newValue = null;
      if (!updatedData.terimaFad || updatedData.terimaFad === "") {
        newValue = null;
        console.log("📅 [updateDataFad] Set terimaFad to null (empty input)");
      } else {
        newValue = parseDate(updatedData.terimaFad);
        console.log("📅 [updateDataFad] Parsed terimaFad result:", newValue);
      }

      // Check if date actually changed (compare dates properly)
      const existingDate = existingRecord.terimaFad
        ? new Date(existingRecord.terimaFad).getTime()
        : null;
      const newDate = newValue ? new Date(newValue).getTime() : null;

      if (existingDate !== newDate) {
        data.terimaFad = newValue;
        changes.terimaFad = {
          from: existingRecord.terimaFad
            ? new Date(existingRecord.terimaFad).toISOString().split("T")[0]
            : null,
          to: newValue ? new Date(newValue).toISOString().split("T")[0] : null,
        };
      }
    }

    if (updatedData.terimaBbm !== undefined) {
      console.log(
        "📅 [updateDataFad] Parsing terimaBbm:",
        updatedData.terimaBbm
      );
      let newValue = null;
      if (!updatedData.terimaBbm || updatedData.terimaBbm === "") {
        newValue = null;
        console.log("📅 [updateDataFad] Set terimaBbm to null (empty input)");
      } else {
        newValue = parseDate(updatedData.terimaBbm);
        console.log("📅 [updateDataFad] Parsed terimaBbm result:", newValue);
      }

      const existingDate = existingRecord.terimaBbm
        ? new Date(existingRecord.terimaBbm).getTime()
        : null;
      const newDate = newValue ? new Date(newValue).getTime() : null;

      if (existingDate !== newDate) {
        data.terimaBbm = newValue;
        changes.terimaBbm = {
          from: existingRecord.terimaBbm
            ? new Date(existingRecord.terimaBbm).toISOString().split("T")[0]
            : null,
          to: newValue ? new Date(newValue).toISOString().split("T")[0] : null,
        };
      }
    }

    if (updatedData.bast !== undefined) {
      console.log("📅 [updateDataFad] Parsing bast:", updatedData.bast);
      let newValue = null;
      if (!updatedData.bast || updatedData.bast === "") {
        newValue = null;
        console.log("📅 [updateDataFad] Set bast to null (empty input)");
      } else {
        newValue = parseDate(updatedData.bast);
        console.log("📅 [updateDataFad] Parsed bast result:", newValue);
      }

      const existingDate = existingRecord.bast
        ? new Date(existingRecord.bast).getTime()
        : null;
      const newDate = newValue ? new Date(newValue).getTime() : null;

      if (existingDate !== newDate) {
        data.bast = newValue;
        changes.bast = {
          from: existingRecord.bast
            ? new Date(existingRecord.bast).toISOString().split("T")[0]
            : null,
          to: newValue ? new Date(newValue).toISOString().split("T")[0] : null,
        };
      }
    }

    if (updatedData.tglAngkut !== undefined) {
      console.log(
        "📅 [updateDataFad] Parsing tglAngkut:",
        updatedData.tglAngkut
      );
      let newValue = null;
      if (!updatedData.tglAngkut || updatedData.tglAngkut === "") {
        newValue = null;
        console.log("📅 [updateDataFad] Set tglAngkut to null (empty input)");
      } else {
        newValue = parseDate(updatedData.tglAngkut);
        console.log("📅 [updateDataFad] Parsed tglAngkut result:", newValue);
      }

      const existingDate = existingRecord.tglAngkut
        ? new Date(existingRecord.tglAngkut).getTime()
        : null;
      const newDate = newValue ? new Date(newValue).getTime() : null;

      if (existingDate !== newDate) {
        data.tglAngkut = newValue;
        changes.tglAngkut = {
          from: existingRecord.tglAngkut
            ? new Date(existingRecord.tglAngkut).toISOString().split("T")[0]
            : null,
          to: newValue ? new Date(newValue).toISOString().split("T")[0] : null,
        };
      }
    }

    // Handle vendor with change tracking
    if (updatedData.vendorId !== undefined) {
      console.log(
        "🏪 [updateDataFad] Processing vendorId:",
        updatedData.vendorId
      );

      let newVendorId = null;
      let newVendorName = null;

      // Handle empty string, null, or undefined vendorId
      if (
        !updatedData.vendorId ||
        updatedData.vendorId === "" ||
        updatedData.vendorId === "null"
      ) {
        newVendorId = null;
        newVendorName = null;
        console.log("🏪 [updateDataFad] Clearing vendor (set to null)");
      } else {
        newVendorId = updatedData.vendorId;
        try {
          const vendor = await prisma.vendor.findUnique({
            where: { id: updatedData.vendorId },
          });
          if (vendor) {
            newVendorName = vendor.name;
            console.log("🏪 [updateDataFad] Found vendor:", vendor.name);
          } else {
            console.warn(
              "⚠️ [updateDataFad] Vendor not found for ID:",
              updatedData.vendorId
            );
            newVendorName = null;
          }
        } catch (vendorError) {
          console.error(
            "❌ [updateDataFad] Error finding vendor:",
            vendorError
          );
          newVendorName = null;
        }
      }

      // Check if vendor changed
      if (newVendorId !== existingRecord.vendorId) {
        data.vendorId = newVendorId;
        data.vendor = newVendorName;
        changes.vendor = {
          from: existingRecord.vendor || null,
          to: newVendorName || null,
        };
      }
    }

    // Handle other string fields with change tracking
    if (
      updatedData.status !== undefined &&
      updatedData.status !== existingRecord.status
    ) {
      const newValue = updatedData.status || null;
      data.status = newValue;
      changes.status = { from: existingRecord.status, to: newValue };
    }
    if (
      updatedData.deskripsi !== undefined &&
      updatedData.deskripsi !== existingRecord.deskripsi
    ) {
      const newValue = updatedData.deskripsi || null;
      data.deskripsi = newValue;
      changes.deskripsi = { from: existingRecord.deskripsi, to: newValue };
      console.log("📝 [updateDataFad] Setting deskripsi:", newValue);
    }
    if (
      updatedData.keterangan !== undefined &&
      updatedData.keterangan !== existingRecord.keterangan
    ) {
      const newValue = updatedData.keterangan || null;
      data.keterangan = newValue;
      changes.keterangan = { from: existingRecord.keterangan, to: newValue };
      console.log("📝 [updateDataFad] Setting keterangan:", newValue);
    }

    // Filter out meaningless changes (null to null, empty to empty, etc.)
    const meaningfulChanges = {};
    Object.entries(changes).forEach(([field, change]) => {
      const { from, to } = change;
      // Skip if both values are null/undefined/empty
      const fromNormalized =
        from === null || from === undefined || from === "" ? null : from;
      const toNormalized =
        to === null || to === undefined || to === "" ? null : to;

      if (fromNormalized !== toNormalized) {
        meaningfulChanges[field] = change;
      }
    });

    console.log(
      "🔧 [updateDataFad] Final data to update:",
      JSON.stringify(data, null, 2)
    );
    console.log(
      "📊 [updateDataFad] Meaningful changes:",
      JSON.stringify(meaningfulChanges, null, 2)
    );

    // Additional validation before update
    if (Object.keys(data).length === 0) {
      console.warn("⚠️ [updateDataFad] No fields to update, skipping");
      return { message: "Tidak ada perubahan data", data: existingRecord };
    }

    const updated = await prisma.fad.update({
      where: { id },
      data,
      include: {
        vendorRel: true, // Include vendor relation for complete data
      },
    });

    console.log("✅ [updateDataFad] Successfully updated record");
    console.log(
      "📊 [updateDataFad] Changes detected:",
      Object.keys(changes).length
    );

    // Return enhanced data for changelog
    return {
      message: "Data berhasil diperbarui",
      data: updated,
      beforeData,
      afterData: updated,
      changes: meaningfulChanges,
      hasChanges: Object.keys(meaningfulChanges).length > 0,
    };
  } catch (e) {
    console.error("❌ [updateDataFad] Error details:", e);
    console.error("❌ [updateDataFad] Stack trace:", e.stack);

    // Provide more specific error messages
    if (e.code === "P2002") {
      throw ApiError.conflict(
        `Duplikasi data: ${e.meta?.target || "field tidak diketahui"}`
      );
    } else if (e.code === "P2025") {
      throw ApiError.notFound(`Data tidak ditemukan dengan ID: ${id}`, { id });
    } else if (e.code === "P2003") {
      throw ApiError.badRequest(
        "Referensi data tidak valid (foreign key constraint)"
      );
    } else if (e.message && e.message.includes("Invalid date")) {
      throw ApiError.badRequest("Format tanggal tidak valid");
    } else if (e instanceof ApiError) {
      throw e;
    } else {
      throw ApiError.internal(
        `Gagal memperbarui data: ${e.message || "Unknown error"}`
      );
    }
  }
};

/**
 * Hapus data FAD berdasarkan ID
 */
const deleteDataFad = async (id) => {
  try {
    // Ambil data lengkap sebelum dihapus untuk changelog
    const beforeData = await prisma.fad.findUnique({
      where: { id },
    });

    if (!beforeData) {
      throw ApiError.notFound("Data FAD tidak ditemukan", { id });
    }

    const deleted = await prisma.fad.delete({ where: { id } });

    return {
      message: "Data berhasil dihapus",
      data: deleted,
      beforeData: beforeData,
    };
  } catch (e) {
    console.error("Gagal menghapus data di DB", e);
    if (e.code === "P2025") {
      throw ApiError.notFound("Data FAD tidak ditemukan", { id });
    }
    if (e instanceof ApiError) {
      throw e;
    }
    throw ApiError.internal(
      `Gagal menghapus data: ${e.message || "Unknown error"}`
    );
  }
};

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
    if (e.code === "P2025") {
      throw ApiError.notFound("Data vendor tidak ditemukan", { id });
    }
    if (e instanceof ApiError) {
      throw e;
    }
    throw ApiError.internal("Gagal memperbarui data vendor");
  }
};

const deleteDataVendor = async (id) => {
  try {
    const deleted = await prisma.vendor.delete({ where: { id } });
    return { message: "Data vendor berhasil dihapus", data: deleted };
  } catch (e) {
    console.error("Gagal menghapus data vendor", e);
    if (e.code === "P2025") {
      throw ApiError.notFound("Data vendor tidak ditemukan", { id });
    }
    if (e instanceof ApiError) {
      throw e;
    }
    throw ApiError.internal("Gagal menghapus data vendor");
  }
};

// Utility: shutdown prisma client
const shutdownPrisma = async () => {
  try {
    await prisma.$disconnect();
    logger.info("Prisma client disconnected");
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
