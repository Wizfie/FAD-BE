// controllers/photoController.js
/**
 * PhotoController
 * - POST /api/photos: supports multipart upload with per-file metadata (fileMeta[]),
 *   optional comparisonGroupId or comparisonGroupTitle to create a group inline.
 * - GET /api/photos: supports query params category, comparisonGroupId, groupByComparison
 * - POST /api/comparison-groups and GET /api/comparison-groups: manage groups
 */
import { PhotoService } from "../services/photoService.js";
import { AreaService } from "../services/areaService.js";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";

export class PhotoController {
  static async upload(req, res) {
    try {
      // Expect body fields: areaId or areaName, optional comparisonGroupId or comparisonGroupTitle
      // and per-file metadata in `fileMeta` (JSON array aligned with files[])
      const { areaId, areaName, comparisonGroupId, comparisonGroupTitle } =
        req.body;

      let finalAreaId = areaId ? Number(areaId) : undefined;
      if (!finalAreaId && areaName) {
        const area = await AreaService.upsertByName(areaName.trim());
        finalAreaId = area.id;
      }

      if (!finalAreaId) {
        return res.status(400).json({ message: "area wajib di isi" });
      }

      // If client asked to create a new group inline
      // decide finalGroupId (prefer numeric comparisonGroupId)
      let finalGroupId = undefined;
      if (comparisonGroupId) {
        const n = Number(comparisonGroupId);
        if (!Number.isNaN(n)) finalGroupId = n;
      }
      // create group inline when a non-empty title is provided
      if (
        !finalGroupId &&
        comparisonGroupTitle &&
        comparisonGroupTitle.trim()
      ) {
        const g = await PhotoService.createGroup({
          title: comparisonGroupTitle.trim(),
          areaId: finalAreaId,
        });
        finalGroupId = g.id;
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: "tidak ada file" });
      }

      // fileMeta: could be sent in multiple shapes. Normalize to array of objects.
      let fileMeta = [];
      if (req.body.fileMeta) {
        try {
          const raw = req.body.fileMeta;
          if (Array.isArray(raw)) {
            fileMeta = raw.map((m) => {
              if (!m) return {};
              if (typeof m === "string") {
                try {
                  return JSON.parse(m);
                } catch (_) {
                  return {};
                }
              }
              // already object
              return m;
            });
          } else if (typeof raw === "string") {
            const s = raw.trim();
            // case: a JSON array string
            if (s.startsWith("[")) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) fileMeta = parsed;
                else fileMeta = [parsed];
              } catch (err) {
                // fallback: try to split into JSON pieces
                const parts = s.split(/}\s*,\s*\{/); // try splitting between objects
                fileMeta = parts.map((p, idx) => {
                  let piece = p;
                  if (idx > 0) piece = "{" + piece;
                  if (idx < parts.length - 1) piece = piece + "}";
                  try {
                    return JSON.parse(piece);
                  } catch (_) {
                    return {};
                  }
                });
              }
            } else {
              // single JSON object string
              try {
                fileMeta = [JSON.parse(s)];
              } catch (err) {
                // unknown format → leave empty
                console.warn("fileMeta parse fallback failed", err, s);
                fileMeta = [];
              }
            }
          } else if (typeof raw === "object") {
            // maybe provided as numeric-keyed object like {0: '{...}', 1: '{...}'}
            const keys = Object.keys(raw);
            const isNumericMap =
              keys.length && keys.every((k) => /^\d+$/.test(k));
            if (isNumericMap) {
              const arr = keys
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => raw[k]);
              fileMeta = arr.map((m) => {
                if (!m) return {};
                if (typeof m === "string") {
                  try {
                    return JSON.parse(m);
                  } catch (_) {
                    return {};
                  }
                }
                return m;
              });
            } else {
              fileMeta = [raw];
            }
          }
        } catch (err) {
          console.warn("fileMeta parse error", err, "raw=", req.body.fileMeta);
        }
      }

      console.log(
        "Parsed fileMeta count=",
        fileMeta.length,
        "files=",
        (req.files || []).length
      );

      // Ensure each meta has comparisonGroupId if finalGroupId present
      const filledMeta = [];
      const allowedCats = ["before", "action", "after"];
      for (let i = 0; i < files.length; i++) {
        const raw = fileMeta[i] || {};
        const m = { ...(raw || {}) };
        const providedCg = m?.comparisonGroupId
          ? Number(m.comparisonGroupId)
          : undefined;
        m.comparisonGroupId = !Number.isNaN(providedCg)
          ? providedCg
          : finalGroupId;

        // validate category value if provided
        if (m.category) {
          const c = String(m.category).toLowerCase();
          if (!allowedCats.includes(c)) {
            return res.status(400).json({
              message: `invalid category for file ${i}: ${m.category}`,
            });
          }
          m.category = c;
        }

        // validate takenAt (optional) — if provided, ensure it's a valid date
        if (m.takenAt) {
          const d = new Date(m.takenAt);
          if (isNaN(d)) {
            return res
              .status(400)
              .json({ message: `invalid takenAt for file ${i}: ${m.takenAt}` });
          }
          m.takenAt = d.toISOString();
        }

        filledMeta.push(m);
      }
      fileMeta = filledMeta;

      const created = await PhotoService.createMany({
        areaId: finalAreaId,
        files,
        publicBaseUrl: env.BASE_URL,
        fileMeta,
      });

      return res.status(201).json({
        message: "Upload Berhasil",
        count: created.count,
        comparisonGroupId: finalGroupId,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(400).json({ message: "Gagal upload" });
    }
  }

  static async list(req, res) {
    const {
      areaId,
      period,
      date,
      page,
      pageSize,
      category,
      comparisonGroupId,
      groupByComparison,
    } = req.query;
    const cgId = comparisonGroupId ? Number(comparisonGroupId) : undefined;
    const safeCgId = !Number.isNaN(cgId) ? cgId : undefined;
    const data = await PhotoService.list({
      areaId: areaId ? Number(areaId) : undefined,
      period,
      date,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      category,
      comparisonGroupId: safeCgId,
      groupByComparison:
        groupByComparison === "true" || groupByComparison === "1",
    });
    // konsisten dengan FE contoh sebelumnya
    return res.json(data);
  }

  static async createGroup(req, res) {
    const { title, areaId, areaName } = req.body;
    if (!title) return res.status(400).json({ message: "title required" });
    let finalAreaId = areaId ? Number(areaId) : undefined;
    if (!finalAreaId && areaName) {
      const a = await AreaService.upsertByName(String(areaName).trim());
      finalAreaId = a.id;
    }
    const g = await PhotoService.createGroup({ title, areaId: finalAreaId });
    return res.status(201).json(g);
  }

  static async listGroups(req, res) {
    const { areaId, page, pageSize } = req.query;
    const data = await PhotoService.listGroups({
      areaId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 24,
    });
    return res.json(data);
  }

  static async getGroup(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    const g = await prisma.comparisonGroup.findUnique({
      where: { id },
      include: { photos: true, area: true },
    });
    if (!g) return res.status(404).json({ message: "group not found" });
    return res.json(g);
  }

  static async updateGroup(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    const { title, description } = req.body;
    try {
      const updated = await PhotoService.updateGroup(id, {
        title,
        description,
      });
      return res.json(updated);
    } catch (err) {
      console.error("Update group error", err);
      return res.status(500).json({ message: "Failed update group" });
    }
  }

  static async remove(req, res) {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0)
      return res.status(400).json({ message: "invalid id" });
    try {
      await PhotoService.remove(id);
      return res.json({ message: "Foto dihapus" });
    } catch (err) {
      console.error("Remove photo error", err);
      // if prisma throws because not found, return 404
      return res.status(404).json({ message: "Foto tidak ditemukan" });
    }
  }
}
