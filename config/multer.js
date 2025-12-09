import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { env } from "./env.js";

// Ensure TPS subfolder exists
const TPS_UPLOAD_DIR = path.join(env.UPLOAD_DIR, "TPS");
if (!fs.existsSync(TPS_UPLOAD_DIR)) {
  fs.mkdirSync(TPS_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TPS_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = crypto.randomBytes(16).toString("hex");
    cb(null, `${basename}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/pjpeg",
      "image/jpg",
      "image/heic",
    ];
    const allowedExts = [".jpg", ".jpeg", ".png", ".heic"];

    const mimeOk = allowedMimes.includes((file.mimetype || "").toLowerCase());
    const extOk = allowedExts.includes(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimeOk && extOk) return cb(null, true);
    return cb(
      new Error(
        `format file tidak diizinkan: mimetype=${
          file.mimetype
        }, ext=${path.extname(file.originalname)}`
      )
    );
    false;
  },
});
