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
import { changeLog } from "./changeLogController.js";
import {
  fmtDateToDDMMYYYY,
  fmtDateTimeDDMMYYYY_HHmmss,
} from "../utils/formatedDate.js";
dotenv.config();

// Tambahkan log saat menyimpan data
const saveDataHandler = async (req, res) => {
  try {
    const formData = req.body;
    const created = await saveDataFad(formData);

    await changeLog("FAD", "CREATE", created);

    res.status(200).json({ message: "created", data: created });
  } catch (e) {
    console.error("Save data failed:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Controller untuk membaca data
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

// Tambahkan log saat memperbarui data
const updateDataHandler = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  try {
    const result = await updateDataFad(id, updatedData);

    // Simpan log perubahan
    await changeLog("FAD", "UPDATE", result);

    res.status(200).json({
      message: "Data updated successfully",
      data: result,
    });
  } catch (e) {
    console.error("Update data failed:", e);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memperbarui data" });
  }
};

// Tambahkan log saat menghapus data
const deleteDataHandler = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteDataFad(id);

    await changeLog("FAD", "DELETE", result);

    res
      .status(200)
      .json({ message: "Data deleted successfully", data: result });
  } catch (e) {
    console.error("Delete data failed:", e);
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus data" });
  }
};

const saveControllerVendor = async (req, res) => {
  try {
    const formData = req.body;
    const created = await saveDataVendor(formData);

    await changeLog("VENDOR", "CREATE", created);

    res.status(200).json({ message: "created", data: created });
  } catch (e) {
    console.error("Save vendor failed:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getControllerVendor = async (req, res) => {
  try {
    const data = await readDataVendor();
    res.status(200).json(data);
  } catch (e) {
    console.error("Get vendor failed:", e);
    res.status(500).json({ message: "Terjadi kesalahan saat membaca data" });
  }
};

const updateControllerVendor = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const result = await updateDataVendor(id, updatedData);

    // Simpan log perubahan
    await changeLog("VENDOR", "UPDATE", result);

    res.status(200).json(result);
  } catch (e) {
    console.error("Update vendor failed:", e);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memperbarui data" });
  }
};

const deleteControllerVendor = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteDataVendor(id);

    // Simpan log perubahan
    await changeLog("VENDOR", "DELETE", result);

    res.status(200).json(result);
  } catch (e) {
    console.error("Delete vendor failed:", e);
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

// Export FAD data as CSV (ADMIN only route will be added in routes)
const exportFadHandler = async (req, res) => {
  try {
    // reuse readDataFad with wide limit to retrieve data (or use pagination params)
    const { q, status } = req.query;
    // use a large limit but keep it reasonable to avoid memory issues
    const limit = Number(req.query.limit) || 10000;
    const page = Number(req.query.page) || 1;

    const result = await readDataFad({ search: q ?? "", page, limit, status });
    let rows = result.data || [];

    // Support date range filtering on createdAt via query params: from, to, all
    // Frontend sends ISO date strings (YYYY-MM-DD) from inputs. If `all` is true, skip filtering.
    const fromParam = req.query.from;
    const toParam = req.query.to;
    const allParam = req.query.all;

    if (!allParam) {
      // apply filter only when at least one of from/to is provided
      if (fromParam || toParam) {
        let start = null;
        let end = null;
        if (fromParam) {
          const d = new Date(fromParam);
          if (!isNaN(d)) {
            start = new Date(d);
            start.setHours(0, 0, 0, 0);
          }
        }
        if (toParam) {
          const d = new Date(toParam);
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

    // Construct CSV header and rows with formatted dates
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
      "keterangan",
      "createdAt",
    ];

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
        `"${String(r.keterangan ?? "").replace(/"/g, '""')}"`,
        r.createdAt ? fmtDateTimeDDMMYYYY_HHmmss(r.createdAt) : "",
      ];
      lines.push(values.join(","));
    }

    const csv = lines.join("\n");
    const filename = `fad-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export FAD failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { exportFadHandler };
