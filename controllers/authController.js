import { logger } from "../utils/unifiedLogger.js";
import {
  refreshWithRotation,
  loginUser,
  registerUser,
  revokeRefresh,
} from "../services/authService.js";
import ApiError from "../utils/ApiError.js";

// Hitung maxAge cookie dari env REFRESH_TOKEN_TTL agar selalu sinkron
const COOKIES_PATH = "/api";

function parseTTLtoMs(ttl) {
  const match = String(ttl || "").match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const [, n, unit] = match;
  const mul = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return parseInt(n, 10) * mul[unit];
}

// Harus sama persis dengan REFRESH_TOKEN_TTL di authService
const REFRESH_COOKIE_MAX_AGE = parseTTLtoMs(
  process.env.REFRESH_TOKEN_TTL || "7d",
);

const cookiesOptSet = {
  httpOnly: true,
  // Gunakan 'None' agar browser sertakan cookie pada cross-origin request sesuai CORS
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: COOKIES_PATH,
  // secure harus true untuk SameSite=None; aktif di production (HTTPS)
  secure: process.env.NODE_ENV === "production",
  maxAge: REFRESH_COOKIE_MAX_AGE,
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
export const registerController = async (req, res, next) => {
  try {
    const { username, password, role, email, status, modules } = req.body;

    // Validation sudah di validator middleware, langsung ke service
    await logger.info("➕ Creating new user", { username });
    const user = await registerUser(
      username,
      password,
      role,
      email,
      status,
      modules,
    );

    // Unified logging - combines changeLog + operation logging
    await logger.register(user, req.ip);
    res
      .status(201)
      .json({ success: true, message: "User registered successfully", user });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller login user
 */
export const loginController = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const tokens = await loginUser(username, password);

    // Unified logging - combines changeLog + audit logging
    await logger.login(tokens.user, req.ip);

    // Kirim refresh token sebagai httpOnly cookie; access token di response body
    res.cookie("refreshToken", tokens.refreshToken, cookiesOptSet);
    res.json({
      success: true,
      message: "Login successful",
      user: tokens.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    // Log auth failure
    await logger.authFailure(
      req.body.username || "unknown",
      req.ip,
      error.message,
    );
    next(error);
  }
};

/**
 * Controller refresh token dengan rotasi
 */
export const refreshController = async (req, res, next) => {
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
        throw ApiError.forbidden("Origin tidak diizinkan", "FORBIDDEN_ORIGIN");
      }
    }

    const { refreshToken } = req.cookies;
    if (!refreshToken)
      throw ApiError.badRequest(
        "No refresh token provided",
        "MISSING_REFRESH_TOKEN",
      );

    const { accessToken, refreshToken: newRt } =
      await refreshWithRotation(refreshToken);
    res.cookie("refreshToken", newRt, cookiesOptSet);
    res.json({ success: true, accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller logout user
 */
export const logoutController = async (req, res, next) => {
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
      res.json({ success: true, message: "Logged out successfully" });
    } else {
      res.json({
        success: true,
        message: "Logged out (no active session found)",
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Controller untuk mendapatkan data user yang sedang login
 */
export const meController = async (req, res) => {
  const { id, username, role, status } = req.user;
  res.json({ id, username, role, status });
};
