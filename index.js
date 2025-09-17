// server/src/server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { shutdownPrisma } from "./services/serviceFad.js";
import { env } from "./config/env.js";

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
    "Create a .env file or set these variables and restart the server."
  );
  process.exit(1);
}

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error(
    "ALLOWED_ORIGINS is not set. In production you must set ALLOWED_ORIGINS to a comma-separated list of allowed origins."
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
  app.use(helmet());
} catch {
  console.warn(
    "Optional package 'helmet' not available — security headers disabled."
  );
}

// Middleware dasar
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ---------- Static Uploads ----------
console.log("UPLOAD_DIR resolved to:", env.UPLOAD_DIR);
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(env.UPLOAD_DIR));

// ---------- Static file lain (contoh user guide) ----------
const folderPath = "C:\\MyLocal\\Data\\DataFad";
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
  res.status(404).json({ message: "Not Found" });
});

// ---------- Error Handler ----------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// ---------- Start ----------
app.listen(port, () => {
  console.info(`Server running on http://localhost:${port}`);
});

// ---------- Graceful Shutdown ----------
const shutdown = async () => {
  console.log("Shutting down server...");
  await shutdownPrisma();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
