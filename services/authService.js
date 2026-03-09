import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { logger } from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// Token TTL — access token berumur pendek, refresh token panjang
// Format: '15m', '4h', '7d' — kompatibel dengan jsonwebtoken
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

function parseTTLtoMs(ttl) {
  const match = String(ttl || "").match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, n, unit] = match;
  const mul = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return parseInt(n, 10) * mul[unit];
}
const REFRESH_TTL_MS = parseTTLtoMs(REFRESH_TTL);

/** Buat access token (JWT pendek) */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, modules: user.modules || [] },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

/**
 * Buat refresh token (JWT panjang).
 * jti = session.id dari DB — satu-satunya hal yang perlu di-lookup.
 * expiresAt opsional: jika diberikan, JWT expires persis saat session DB expires.
 * Jika tidak diberikan (login baru), pakai REFRESH_TTL default.
 */
function signRefreshToken(userId, jti, expiresAt) {
  const options = expiresAt
    ? {
        expiresIn: Math.max(
          1,
          Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        ),
      }
    : { expiresIn: REFRESH_TTL };
  return jwt.sign({ sub: userId, jti }, REFRESH_TOKEN_SECRET, options);
}

/**
 * Registrasi user baru
 */
export const registerUser = async (
  username,
  password,
  role = "USER",
  email = null,
  status = "ACTIVE",
  modules = null,
) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // For SUPER_ADMIN, modules should be null
    const moduleData = role === "SUPER_ADMIN" ? null : modules;

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        email,
        status,
        modules: moduleData,
      },
    });
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      modules: user.modules,
      email: user.email,
      status: user.status,
    };
  } catch (error) {
    // Handle Prisma duplicate unique constraint error
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "field";
      if (field === "username") {
        throw ApiError.conflict(
          "Username sudah digunakan. Silakan pilih username yang berbeda.",
          "DUPLICATE_USERNAME",
          { field: "username" },
        );
      } else if (field === "email") {
        throw ApiError.conflict(
          "Email sudah terdaftar. Silakan gunakan email yang berbeda.",
          "DUPLICATE_EMAIL",
          { field: "email" },
        );
      }
    }
    // Re-throw as generic internal error jika bukan P2002
    throw ApiError.internal(
      "Terjadi kesalahan saat membuat user",
      "USER_CREATION_ERROR",
    );
  }
};

/**
 * Login user dan buat session
 */
export const loginUser = async (username, password) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user)
    throw ApiError.notFound("User tidak ditemukan", "USER_NOT_FOUND", {
      username,
    });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw ApiError.unauthorized("Password salah", "INVALID_CREDENTIALS");

  if (user.status !== "ACTIVE")
    throw ApiError.forbidden("User disabled", "USER_DISABLED");

  // Buat session di DB — id-nya menjadi jti di dalam JWT
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const session = await prisma.refreshSession.create({
    data: { userId: user.id, expiresAt },
  });

  if (process.env.NODE_ENV !== "production") {
    logger.debug("New login session created", {
      sessionId: session.id,
      userId: user.id,
    });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id, session.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      modules: user.modules || [],
      status: user.status,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh token dengan rotasi:
 * 1. Verifikasi JWT dengan REFRESH_TOKEN_SECRET → ambil jti (session id)
 * 2. Lookup session di DB by primary key (sangat cepat)
 * 3. Dalam satu transaksi: DELETE session lama, CREATE session baru
 * 4. Return access token baru + refresh token baru (keduanya fresh)
 */
export const refreshWithRotation = async (token) => {
  if (!token)
    throw ApiError.badRequest("No refresh token", "MISSING_REFRESH_TOKEN");

  let jti, userId;
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    jti = payload.jti;
    userId = payload.sub;
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw ApiError.unauthorized("Refresh token expired", "TOKEN_EXPIRED");
    throw ApiError.unauthorized(
      "Invalid refresh token",
      "INVALID_REFRESH_TOKEN",
    );
  }

  try {
    const { newRefreshToken, user } = await prisma.$transaction(async (tx) => {
      // Lookup session by PK (jti = session.id)
      const session = await tx.refreshSession.findUnique({
        where: { id: jti },
      });

      if (!session) {
        throw ApiError.unauthorized(
          "Session tidak ditemukan",
          "INVALID_REFRESH_TOKEN",
        );
      }
      if (session.expiresAt < new Date()) {
        await tx.refreshSession.delete({ where: { id: jti } });
        throw ApiError.unauthorized("Refresh token expired", "TOKEN_EXPIRED");
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.status !== "ACTIVE") {
        await tx.refreshSession.delete({ where: { id: jti } });
        throw ApiError.forbidden(
          "User tidak valid atau disabled",
          "USER_INVALID",
        );
      }

      // Rotasi: hapus lama, buat baru — atomik dalam transaksi
      // expiresAt DIWARISI dari session lama, bukan dihitung ulang dari sekarang.
      // Ini memastikan total lifetime refresh token tetap dibatasi sejak login,
      // bukan terus-menerus diperpanjang setiap kali dirotasi.
      await tx.refreshSession.delete({ where: { id: jti } });
      const newSession = await tx.refreshSession.create({
        data: { userId: user.id, expiresAt: session.expiresAt },
      });

      return {
        newRefreshToken: signRefreshToken(
          user.id,
          newSession.id,
          session.expiresAt,
        ),
        user,
      };
    });

    return {
      accessToken: signAccessToken(user),
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal("Gagal refresh token", "REFRESH_TOKEN_ERROR");
  }
};

/**
 * Revoke refresh token saat logout — DELETE session dari DB.
 * Pakai jwt.decode (tanpa verify) agar token yang sudah expired
 * pun tetap bisa di-revoke saat user logout.
 */
export const revokeRefresh = async (token) => {
  try {
    if (!token) return false;
    // decode tanpa verify — kita hanya butuh jti untuk hapus session dari DB
    const payload = jwt.decode(token);
    const jti = payload?.jti;
    if (!jti) return false;
    await prisma.refreshSession.delete({ where: { id: jti } });
    if (process.env.NODE_ENV !== "production")
      logger.debug("Refresh session deleted on logout", { sessionId: jti });
    return true;
  } catch (error) {
    // P2025 = record not found di Prisma → session sudah tidak ada, anggap sukses
    if (error.code === "P2025") return true;
    logger.error("Failed to revoke refresh token", {
      error: error?.message ?? error,
    });
    return false;
  }
};

/**
 * Hapus session yang sudah expired (housekeeping)
 * Dipanggil periodik oleh setInterval di index.js
 */
export const cleanupExpiredSessions = async () => {
  const result = await prisma.refreshSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  logger.info(`Cleaned up ${result.count} expired refresh sessions`);
  return result.count;
};
