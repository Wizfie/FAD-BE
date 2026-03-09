// server/src/server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { shutdownPrisma } from "./services/serviceFad.js";
import { cleanupExpiredSessions } from "./services/authService.js";
import { runBackup, runUploadsBackup } from "./scripts/backupDb.js";
import cron from "node-cron";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import ApiError from "./utils/ApiError.js";
import { authenticate } from "./middlewares/authMiddlewares.js";
import { requireAdmin } from "./middlewares/permission.js";

// ---------- Validasi ENV penting ----------
const requiredEnvs = [
  "DATABASE_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];
const missing = requiredEnvs.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("Missing required environment variables:", missing.join(", "));
  console.error(
    "Create a .env file or set these variables and restart the server.",
  );
  process.exit(1);
}

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error(
    "ALLOWED_ORIGINS is not set. In production you must set ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
  );
  process.exit(1);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("CORS not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// ---------- App ----------
const app = express();
const port = env.PORT || 5001;

// Security headers (opsional): aktif jika paket tersedia
try {
  const { default: helmet } = await import("helmet");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );
} catch {
  console.warn(
    "Optional package 'helmet' not available — security headers disabled.",
  );
}

// Middleware dasar
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ---------- Static Uploads ----------
logger.info("UPLOAD_DIR resolved", { uploadDir: env.UPLOAD_DIR });
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
app.use(
  "/uploads",
  authenticate,
  requireAdmin,
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(env.UPLOAD_DIR),
);
// ---------- Static file lain (contoh user guide) ----------
const folderPath =
  process.env.DATA_FOLDER_PATH || path.join(process.cwd(), "data");
const filePathGuide = path.join(folderPath, "Guide.pdf");
app.get("/userguide", async (_req, res) => {
  try {
    const data = await fs.promises.readFile(filePathGuide);
    res.contentType("application/pdf").send(data);
  } catch (err) {
    console.error("Gagal membaca file panduan pengguna", err);
    res.status(500).json({
      message: "Gagal membaca file panduan pengguna",
      error: err.message,
    });
  }
});

// ---------- API Routes ----------
app.use("/api", routes);

// ---------- 404 Handler ----------
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// ---------- Error Handler (CENTRALIZED) ----------
app.use((err, req, res, _next) => {
  let apiErr = err;

  // Jika error bukan ApiError, wrap ke ApiError
  if (!(err instanceof ApiError)) {
    // Handle Prisma errors
    if (err.code === "P2002") {
      const field = err.meta?.target?.[0] || "field";
      apiErr = ApiError.conflict(`Duplicate ${field}`, "DUPLICATE_FIELD", {
        field,
      });
    }
    // Handle JWT errors
    else if (err.name === "JsonWebTokenError") {
      apiErr = ApiError.unauthorized("Invalid token", "INVALID_TOKEN");
    } else if (err.name === "TokenExpiredError") {
      apiErr = ApiError.unauthorized("Token expired", "TOKEN_EXPIRED");
    }
    // Handle other errors
    else {
      apiErr = ApiError.internal(
        err.message || "Internal Server Error",
        "INTERNAL_ERROR",
      );
    }
  }

  const statusCode = apiErr.statusCode || 500;

  // Log error dengan request context
  logger.error("API Error", {
    statusCode,
    message: apiErr.message,
    code: apiErr.code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    stack: process.env.NODE_ENV === "development" ? apiErr.stack : undefined,
  });

  // Response format konsisten
  res.status(statusCode).json({
    success: false,
    message: apiErr.message,
    code: apiErr.code,
    meta: apiErr.meta,
    ...(process.env.NODE_ENV === "development" && { stack: apiErr.stack }),
  });
});

// ---------- Start ----------
app.listen(port, () => {
  console.info(`Server running on http://localhost:${port}`);
});

// ---------- Cleanup expired refresh sessions (setiap 12 jam) ----------
const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
setInterval(() => {
  cleanupExpiredSessions().catch((err) =>
    logger.error("Session cleanup failed", { error: err?.message }),
  );
}, CLEANUP_INTERVAL_MS);
// Jalankan sekali saat startup
cleanupExpiredSessions().catch((err) =>
  logger.error("Session cleanup (startup) failed", { error: err?.message }),
);

// ---------- Auto Backup DB (setiap hari jam 10:00) ----------
// Format cron: detik(opsional) menit jam hari bulan hari-minggu
cron.schedule("0 10 * * *", () => {
  runBackup()
    .then((r) =>
      logger.info(
        `DB backup berhasil: ${r.filename} (${r.sizeMB} MB) [${r.method}], ${r.deletedOldBackups} lama dihapus`,
      ),
    )
    .catch((err) => logger.error("DB backup gagal", { error: err?.message }));

  runUploadsBackup()
    .then((r) =>
      logger.info(
        `Uploads backup berhasil: ${r.filesCopied} file baru disalin`,
      ),
    )
    .catch((err) =>
      logger.error("Uploads backup gagal", { error: err?.message }),
    );
});

// ---------- Graceful Shutdown ----------
const shutdown = async () => {
  logger.info("Shutting down server...");
  await shutdownPrisma();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
