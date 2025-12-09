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
import { Logger } from "../utils/logger.js";
dotenv.config();

/**
 * Handler simpan data FAD dengan logging
 */
const saveDataHandler = async (req, res) => {
  try {
    const formData = req.body;

    Logger.request(req, "📨 Received form data for FAD creation");
    Logger.debug("Form data details", { formData });

    // Server-side validation and formatting
    let noFad = String(formData.noFad || "").trim();
    const item = String(formData.item || "").trim();

    if (!noFad) {
      console.warn("❌ Validation failed: No FAD is required");
      return res.status(400).json({
        error: "No FAD wajib diisi",
        field: "noFad",
      });
    }

    // Auto-format No FAD to uppercase
    noFad = noFad.toUpperCase();
    formData.noFad = noFad;

    Logger.debug("📝 Backend auto-formatted No FAD", { noFad });

    // Optional: Validate No FAD format (flexible pattern)
    // Allows letters, numbers, slashes, hyphens, dots
    const noFadPattern = /^[A-Z0-9\/\-\.\s]+$/;
    if (!noFadPattern.test(noFad)) {
      Logger.validation("noFad", noFad, "Invalid No FAD format");
      return res.status(400).json({
        error:
          "Format No FAD tidak valid. Gunakan huruf besar, angka, slash (/), atau tanda hubung (-)",
        field: "noFad",
        value: noFad,
      });
    }

    if (!item) {
      Logger.validation("item", null, "Item is required");
      return res.status(400).json({
        error: "Item wajib diisi",
        field: "item",
      });
    }

    Logger.debug("✅ Backend validation passed");
    const created = await saveDataFad(formData);

    // Audit log for FAD creation
    await Logger.auditCreate(
      "FAD",
      created.id,
      {
        noFad: created.noFad,
        item: created.item,
        plant: created.plant,
        status: created.status,
      },
      req.user
    );

    res.status(200).json({ message: "created", data: created });
  } catch (e) {
    Logger.error("Save data failed", {
      error: e.message,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json({ error: "Internal server error", details: e.message });
  }
};

/**
 * Handler baca data FAD dengan filter dan pagination
 */
const getDataHandler = async (req, res) => {
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
    res.status(200).json(result);
  } catch (e) {
    console.error("Get data failed:", e);
    res.status(500).json({ message: "Terjadi kesalahan saat membaca data" });
  }
};

/**
 * Handler update data FAD dengan logging
 */
const updateDataHandler = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  console.log("🔥 [updateDataHandler] Update request received");
  console.log("🔥 [updateDataHandler] ID:", id);
  console.log(
    "🔥 [updateDataHandler] Request body:",
    JSON.stringify(updatedData, null, 2)
  );
  console.log(
    "🔥 [updateDataHandler] Content-Type:",
    req.headers["content-type"]
  );

  try {
    const result = await updateDataFad(id, updatedData);

    // Audit log for FAD update - only log if there are actual changes
    if (result.hasChanges && result.changes) {
      await Logger.auditUpdate("FAD", id, result.changes, req.user);
    } else {
      console.log(
        "📝 [updateDataHandler] No changes detected, skipping changelog"
      );
    }

    console.log("✅ [updateDataHandler] Update successful");
    res.status(200).json({
      message: "Data updated successfully",
      data: result.data, // Return only the updated data, not the changelog info
    });
  } catch (e) {
    console.error("❌ [updateDataHandler] Update failed:", e.message);
    console.error("❌ [updateDataHandler] Stack:", e.stack);

    Logger.error("Update data failed", {
      error: e.message,
      fadId: id,
      userId: req.user?.id,
    });

    res.status(500).json({
      message: "Terjadi kesalahan saat memperbarui data",
      error: e.message, // Include detailed error for debugging
    });
  }
};

/**
 * Handler hapus data FAD dengan logging
 */
const deleteDataHandler = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteDataFad(id);

    // Audit log for FAD deletion
    await Logger.auditDelete(
      "FAD",
      id,
      {
        noFad: result.beforeData?.noFad,
        item: result.beforeData?.item,
        status: result.beforeData?.status,
      },
      req.user
    );

    res
      .status(200)
      .json({ message: "Data deleted successfully", data: result });
  } catch (e) {
    Logger.error("Delete data failed", {
      error: e.message,
      fadId: id,
      userId: req.user?.id,
    });
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus data" });
  }
};

/**
 * Handler simpan data vendor dengan logging
 */
const saveControllerVendor = async (req, res) => {
  try {
    const formData = req.body;
    const created = await saveDataVendor(formData);

    // Audit log for vendor creation
    await Logger.auditCreate(
      "VENDOR",
      created.id,
      { name: created.name, active: created.active },
      req.user
    );

    res.status(200).json({ message: "created", data: created });
  } catch (e) {
    await logger.error("Save vendor failed", {
      error: e.message,
      userId: req.user?.id,
    });
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Handler baca data vendor
 */
const getControllerVendor = async (req, res) => {
  try {
    const data = await readDataVendor();
    res.status(200).json(data);
  } catch (e) {
    console.error("Get vendor failed:", e);
    res.status(500).json({ message: "Terjadi kesalahan saat membaca data" });
  }
};

/**
 * Handler update data vendor dengan logging
 */
const updateControllerVendor = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const result = await updateDataVendor(id, updatedData);

    // Unified logging
    await logger.update("VENDOR", { id, result }, req.user);

    res.status(200).json(result);
  } catch (e) {
    await logger.error("Update vendor failed", {
      error: e.message,
      vendorId: id,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memperbarui data" });
  }
};

/**
 * Handler hapus data vendor dengan logging
 */
const deleteControllerVendor = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteDataVendor(id);

    // Unified logging
    await logger.delete("VENDOR", { id, result }, req.user);

    res.status(200).json(result);
  } catch (e) {
    await logger.error("Delete vendor failed", {
      error: e.message,
      vendorId: id,
      userId: req.user?.id,
    });
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus data" });
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

/**
 * Handler export data FAD ke CSV (khusus ADMIN)
 */
const exportFadHandler = async (req, res) => {
  try {
    // Extract all filter parameters
    const {
      q,
      status,
      startDate,
      endDate,
      includeImages,
      includeComments,
      all,
    } = req.query;

    // gunakan limit besar tapi tetap wajar untuk hindari masalah memory
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
