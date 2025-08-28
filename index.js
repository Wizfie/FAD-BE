import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import routes from "./routes/index.js";
import { shutdownPrisma } from "./services/serviceFad.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
const app = express();
const port = process.env.PORT || 5001;
dotenv.config();

// Validate required environment variables early to avoid insecure startup
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
  // Exit with failure to avoid running in insecure state
  process.exit(1);
}

// Daftar origins yang diizinkan
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

// In production, ALLOWED_ORIGINS must be set to avoid accepting requests from
// arbitrary origins when cookies are used for auth.
if (process.env.NODE_ENV === "production") {
  if (!process.env.ALLOWED_ORIGINS || allowedOrigins.length === 0) {
    console.error(
      "ALLOWED_ORIGINS is not set. In production you must set ALLOWED_ORIGINS to a comma-separated list of allowed origins."
    );
    process.exit(1);
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Izinkan pengiriman cookie
};

// Try to enable Helmet (security headers) if installed. Keep optional so dev
// environment without the package won't crash the server.
try {
  const _helmet = await import("helmet");
  const helmet = _helmet.default;

  // Basic security headers (no CSP configured here)
  app.use(helmet());

  // // HSTS is beneficial in production to force HTTPS
  // if (process.env.NODE_ENV === "production") {
  //   app.use(
  //     helmet.hsts({
  //       maxAge: 31536000,
  //       includeSubDomains: true,
  //       preload: true,
  //     })
  //   );
  // }
} catch (e) {
  console.warn(
    "Optional package 'helmet' not available — security headers disabled."
  );
}

// Menggunakan CORS middleware dengan konfigurasi yang lebih fleksibel
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());

const folderPath = "C:\\MyLocal\\Data\\DataFad";
const filePathGuide = path.join(folderPath, "Guide.pdf");

app.get("/userguide", async (req, res) => {
  try {
    const data = await fs.promises.readFile(filePathGuide);
    res.contentType("application/pdf");
    res.send(data);
  } catch (err) {
    console.error("Gagal membaca file panduan pengguna", err);
    res.status(500).send({
      message: "Gagal membaca file panduan pengguna",
      error: err.message,
    });
  }
});

app.use(express.json());
app.use(cookieParser());

// Menggunakan routes untuk data
app.use("/api", routes);

app.listen(port, () => {
  console.info("Server Running in port " + port);
});

const shutdown = async () => {
  console.log("Shutting down server...");
  await shutdownPrisma();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
