import {
  saveDataFad,
  readDataFad,
  updateDataFad,
  deleteDataFad,
  saveDataVendor,
  readDataVendor,
  updateDataVendor,
  deleteDataVendor,
} from "../services/serviceFad.js";
import dotenv from "dotenv";
import {
  fmtDateToDDMMYYYY,
  fmtDateTimeDDMMYYYY_HHmmss,
} from "../utils/formatedDate.js";
import { logger } from "../utils/unifiedLogger.js";
import { changeLog } from "./changeLogController.js";
import ApiError from "../utils/ApiError.js";
dotenv.config();

const saveDataHandler = async (req, res, next) => {
  try {
    const formData = req.body;

    logger.request(req, "📨 Received form data for FAD creation");
    logger.debug("Form data details", { formData });

    // Server-side validation and formatting
    let noFad = String(formData.noFad || "").trim();
    const item = String(formData.item || "").trim();

    if (!noFad) {
      throw ApiError.badRequest("No FAD wajib diisi", { field: "noFad" });
    }

    // Auto-format No FAD to uppercase
    noFad = noFad.toUpperCase();
    formData.noFad = noFad;

    logger.debug("📝 Backend auto-formatted No FAD", { noFad });

    // Optional: Validate No FAD format (flexible pattern)
    // Allows letters, numbers, slashes, hyphens, dots
    const noFadPattern = /^[A-Z0-9\/\-\.\s]+$/;
    if (!noFadPattern.test(noFad)) {
      throw ApiError.badRequest(
        "Format No FAD tidak valid. Gunakan huruf besar, angka, slash (/), atau tanda hubung (-)",
        { field: "noFad", value: noFad },
      );
    }

    if (!item) {
      throw ApiError.badRequest("Item wajib diisi", { field: "item" });
    }

    await logger.debug("✅ Backend validation passed");
    const created = await saveDataFad(formData);

    // Save to AuditLog
    await changeLog(
      "FAD",
      "CREATE",
      { id: created.id, noFad: created.noFad },
      req.user,
    );

    // Unified logging - combines changeLog + operation logging
    await logger.create(
      "FAD",
      { id: created.id, noFad: created.noFad },
      req.user,
    );
    res.status(201).json({
      success: true,
      message: "Data FAD berhasil dibuat",
      data: created,
    });
  } catch (e) {
    next(e);
  }
};

const getDataHandler = async (req, res, next) => {
  try {
    const { q, page, limit, fields, status } = req.query;
    const fieldList = fields
      ? String(fields)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined;
    const result = await readDataFad({
      search: q ?? "",
      page: page ?? 1,
      limit: limit ?? 50,
      fields: fieldList,
      status: status ?? undefined,
    });
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
};

const updateDataHandler = async (req, res, next) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    if (!id) {
      throw ApiError.badRequest("ID FAD harus disediakan", { param: "id" });
    }

    const result = await updateDataFad(id, updatedData);

    if (result.hasChanges) {
      await changeLog(
        "FAD",
        "UPDATE",
        {
          id: id,
          changes: result.changes,
        },
        req.user,
      );

      await logger.update(
        "FAD",
        {
          id,
          beforeData: result.beforeData,
          afterData: result.afterData,
          changes: result.changes,
        },
        req.user,
      );
    }

    res.json({
      success: true,
      message: "Data FAD berhasil diupdate",
      data: result.data,
    });
  } catch (e) {
    next(e);
  }
};

const deleteDataHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!id) {
      throw ApiError.badRequest("ID FAD harus disediakan", { param: "id" });
    }

    const result = await deleteDataFad(id);

    // Save to AuditLog
    await changeLog(
      "FAD",
      "DELETE",
      {
        id: id,
        noFad: result.beforeData?.noFad,
      },
      req.user,
    );

    // Enhanced logging with before data for complete audit trail
    await logger.delete(
      "FAD",
      {
        id,
        beforeData: result.beforeData,
        result,
      },
      req.user,
    );

    res.json({
      success: true,
      message: "Data FAD berhasil dihapus",
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

const saveControllerVendor = async (req, res, next) => {
  try {
    const formData = req.body;

    if (!formData.name) {
      throw ApiError.badRequest("Nama vendor wajib diisi", { field: "name" });
    }

    const created = await saveDataVendor(formData);

    // Unified logging
    await logger.create(
      "VENDOR",
      { id: created.id, name: created.name },
      req.user,
    );

    res.status(201).json({
      success: true,
      message: "Data vendor berhasil dibuat",
      data: created,
    });
  } catch (e) {
    next(e);
  }
};

const getControllerVendor = async (req, res, next) => {
  try {
    const data = await readDataVendor();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

const updateControllerVendor = async (req, res, next) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    if (!id) {
      throw ApiError.badRequest("ID vendor harus disediakan", { param: "id" });
    }

    const result = await updateDataVendor(id, updatedData);

    // Unified logging
    await logger.update("VENDOR", { id, result }, req.user);

    res.json({
      success: true,
      message: "Data vendor berhasil diupdate",
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

const deleteControllerVendor = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!id) {
      throw ApiError.badRequest("ID vendor harus disediakan", { param: "id" });
    }

    const result = await deleteDataVendor(id);

    // Unified logging
    await logger.delete("VENDOR", { id, result }, req.user);

    res.json({
      success: true,
      message: "Data vendor berhasil dihapus",
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

export {
  saveDataHandler,
  getDataHandler,
  updateDataHandler,
  deleteDataHandler,
  saveControllerVendor,
  getControllerVendor,
  updateControllerVendor,
  deleteControllerVendor,
};

const exportFadHandler = async (req, res) => {
  try {
    const {
      q,
      status,
      startDate,
      endDate,
      includeImages,
      includeComments,
      all,
    } = req.query;

    const limit = Number(req.query.limit) || 10000;
    const page = Number(req.query.page) || 1;

    const result = await readDataFad({ search: q ?? "", page, limit, status });
    let rows = result.data || [];

    // Apply filters if not exporting all data
    if (!all) {
      // Date range filter (always based on createdAt)
      if (startDate || endDate) {
        let start = null;
        let end = null;

        if (startDate) {
          const d = new Date(startDate);
          if (!isNaN(d)) {
            start = new Date(d);
            start.setHours(0, 0, 0, 0);
          }
        }

        if (endDate) {
          const d = new Date(endDate);
          if (!isNaN(d)) {
            end = new Date(d);
            end.setHours(23, 59, 59, 999);
          }
        }

        if (start || end) {
          rows = rows.filter((r) => {
            if (!r.createdAt) return false;
            const created = new Date(r.createdAt);
            if (isNaN(created)) return false;
            if (start && end) return created >= start && created <= end;
            if (start) return created >= start;
            if (end) return created <= end;
            return true;
          });
        }
      }
    }

    // Build CSV header dynamically based on options
    const header = [
      "id",
      "noFad",
      "item",
      "plant",
      "terimaFad",
      "terimaBbm",
      "bast",
      "tanggalAngkut",
      "vendor",
      "status",
      "deskripsi",
      "createdAt",
    ];

    // Add optional columns based on query parameters
    if (includeComments !== "false") {
      header.push("keterangan");
    }

    if (includeImages !== "false") {
      header.push("hasImages");
    }

    const lines = [header.join(",")];

    for (const r of rows) {
      const values = [
        r.id,
        `"${String(r.noFad ?? "").replace(/"/g, '""')}"`,
        `"${String(r.item ?? "").replace(/"/g, '""')}"`,
        `"${String(r.plant ?? "").replace(/"/g, '""')}"`,
        `"${fmtDateToDDMMYYYY(r.terimaFad)}"`,
        `"${fmtDateToDDMMYYYY(r.terimaBbm)}"`,
        `"${fmtDateToDDMMYYYY(r.bast)}"`,
        `"${fmtDateToDDMMYYYY(r.tanggalAngkut)}"`,
        `"${String(r.vendor ?? r.vendorRel?.name ?? "").replace(/"/g, '""')}"`,
        `"${String(r.status ?? "").replace(/"/g, '""')}"`,
        `"${String(r.deskripsi ?? "").replace(/"/g, '""')}"`,
        r.createdAt ? fmtDateTimeDDMMYYYY_HHmmss(r.createdAt) : "",
      ];

      // Add optional columns based on query parameters
      if (includeComments !== "false") {
        values.push(`"${String(r.keterangan ?? "").replace(/"/g, '""')}"`);
      }

      if (includeImages !== "false") {
        // Check if this FAD has associated images
        const hasImages =
          r.photos && Array.isArray(r.photos) && r.photos.length > 0
            ? "Yes"
            : "No";
        values.push(`"${hasImages}"`);
      }

      lines.push(values.join(","));
    }

    const csv = lines.join("\n");

    // Generate filename based on filters
    let filename = "fad-export";
    const today = new Date().toISOString().slice(0, 10);

    if (status) filename += `-${status.toLowerCase()}`;

    if (startDate && endDate) filename += `-${startDate}-to-${endDate}`;
    else if (startDate) filename += `-from-${startDate}`;
    else if (endDate) filename += `-until-${endDate}`;

    filename += `-${today}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export FAD failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { exportFadHandler };
