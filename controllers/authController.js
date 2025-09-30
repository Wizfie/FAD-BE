import { changeLog } from "./changeLogController.js";
import { securityLogger } from "../utils/securityLogger.js";
import {
  refreshWithRotation,
  loginUser,
  registerUser,
  revokeRefresh,
} from "../services/authService.js";

const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
const COOKIES_PATH = "/api";

const cookiesOptSet = {
  httpOnly: true,
  // Gunakan 'None' agar browser sertakan cookie pada cross-origin request sesuai CORS
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: COOKIES_PATH,
  // secure harus true untuk SameSite=None; aktif di production (HTTPS)
  secure: process.env.NODE_ENV === "production",
  maxAge: ONE_DAY_MS,
};
const cookiesOptClear = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: COOKIES_PATH,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Controller registrasi user baru
 */
export const registerController = async (req, res) => {
  const { username, password, role, email, status } = req.body;

  try {
    // Validation
    if (!username || !username.trim()) {
      return res.status(400).json({
        error: "Username wajib diisi",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: "Username minimal 3 karakter",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: "Password minimal 6 karakter",
      });
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: "Format email tidak valid",
        });
      }
    }

    console.log("➕ Creating new user:", username);
    const user = await registerUser(username, password, role, email, status);
    await changeLog("USER", "REGISTER", user);

    console.log("✅ User registered successfully:", user.username);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("❌ Error registering user:", error);

    // Handle Prisma unique constraint errors
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "field";
      if (field === "username") {
        return res.status(400).json({
          error:
            "Username sudah digunakan. Silakan pilih username yang berbeda.",
        });
      } else if (field === "email") {
        return res.status(400).json({
          error: "Email sudah terdaftar. Silakan gunakan email yang berbeda.",
        });
      } else {
        return res.status(400).json({
          error: "Data sudah ada. Username atau email sudah digunakan.",
        });
      }
    }

    // Handle other Prisma errors
    if (error.code && error.code.startsWith("P")) {
      console.error("Prisma error code:", error.code, error.message);
      return res.status(400).json({
        error: "Terjadi kesalahan validasi data",
      });
    }

    // Handle validation errors
    if (
      error.message &&
      (error.message.includes("validation") ||
        error.message.includes("required") ||
        error.message.includes("invalid"))
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    // Generic server error
    res.status(500).json({
      error: "Terjadi kesalahan di server. Silakan coba lagi.",
    });
  }
};

/**
 * Controller login user
 */
export const loginController = async (req, res) => {
  try {
    const { username, password } = req.body;
    const tokens = await loginUser(username, password);

    // Catat event login tanpa logging token atau session identifier
    await changeLog("USER", "LOGIN", {
      userId: tokens.user.id,
      username: tokens.user.username,
      ip: req.ip,
    });

    // Kirim refresh token sebagai httpOnly cookie; access token di response body
    res.cookie("refreshToken", tokens.refreshToken, cookiesOptSet);
    res.json({
      message: "Login successful",
      user: tokens.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error("Login failed:", error);

    // Log percobaan login gagal
    securityLogger.logAuthFailure(req.body.username, req.ip, error.message);

    res.status(401).json({ error: "Invalid credentials" });
  }
};

/**
 * Controller refresh token dengan rotasi
 */
export const refreshController = async (req, res) => {
  try {
    // Cek Origin/Referer dasar untuk mitigasi CSRF saat gunakan cookie-based refresh
    // Jika ALLOWED_ORIGINS diset, require Origin atau Referer host yang diizinkan
    const allowed = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
      : [];
    const origin = req.get("origin") || req.get("referer") || null;
    if (allowed.length > 0 && origin) {
      // origin mungkin include path saat pakai referer; ekstrak origin saja
      let originHost = origin;
      try {
        const u = new URL(origin);
        originHost = u.origin;
      } catch (e) {
        // jika referer berisi path, coba ekstrak origin
        const m = origin.match(/^(https?:\/\/[^\/]+)/i);
        if (m) originHost = m[1];
      }
      if (!allowed.includes(originHost)) {
        console.warn(
          "Rejected refresh request from disallowed origin:",
          originHost
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new Error("No refresh token provided");

    const { accessToken, refreshToken: newRt } = await refreshWithRotation(
      refreshToken
    );
    res.cookie("refreshToken", newRt, cookiesOptSet);
    res.json({ accessToken });
  } catch (error) {
    console.error("Refresh token failed:", error);
    res.clearCookie("refreshToken", cookiesOptClear);
    res.status(401).json({ error: "Could not refresh token" });
  }
};

/**
 * Controller logout user
 */
export const logoutController = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    let revoked = false;
    if (refreshToken) {
      revoked = await revokeRefresh(refreshToken);
    }

    // Selalu clear cookie pada logout request untuk pastikan client-side logout
    res.clearCookie("refreshToken", cookiesOptClear);

    // Informasi client tentang hasil; tetap return 200 untuk idempotent logout
    if (revoked) {
      res.json({ message: "Logged out successfully" });
    } else {
      res.json({ message: "Logged out (no active session found)" });
    }
  } catch (error) {
    console.error("Logout failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Controller untuk mendapatkan data user yang sedang login
 */
export const meController = async (req, res) => {
  const { id, username, role, status } = req.user;
  res.json({ id, username, role, status });
};
