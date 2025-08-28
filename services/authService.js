import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// Token TTL defaults — use short access token and reasonable refresh token
// Format supports strings like '15m', '1h', '7d' compatible with jsonwebtoken
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefreshToken(userId, jti) {
  return jwt.sign(
    {
      sub: userId,
      jti,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TTL }
  );
}

export const registerUser = async (username, password, role = "USER") => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role,
    },
  });
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
};

export const loginUser = async (username, password) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error("User not found");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid credentials");

  if (user.status !== "ACTIVE") throw new Error("User disabled");

  // Buat session di DB → Prisma generate UUID otomatis
  const session = await prisma.refreshSession.create({
    data: { userId: user.id },
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("new login session id =", session.id);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id, session.id);

  return {
    user: { id: user.id, username: user.username, role: user.role },
    accessToken,
    refreshToken,
  };
};

const readDataUser = async () => {
  try {
    const users = await prisma.user.findMany();
    console.log("users:", users);
    return users;
  } catch (error) {
    throw new Error("Gagal membaca data user");
  }
};

export const refreshWithRotation = async (token) => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    const jti = payload.jti;
    const userId = payload.sub;

    const session = await prisma.refreshSession.findUnique({
      where: { id: jti },
    });
    if (!session || session.revoked) throw new Error("Invalid refresh token");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") throw new Error("User Invalid");

    const newSession = await prisma.refreshSession.create({
      data: { userId: user.id },
    });

    // Revoke

    await prisma.refreshSession.update({
      where: { id: jti },
      data: { revoked: true, replacedById: newSession.id },
    });

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user.id, newSession.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw new Error("Invalid refresh token");
  }
};

export const revokeRefresh = async (token) => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    const jti = payload.jti;
    if (!jti) {
      if (process.env.NODE_ENV !== "production")
        console.warn("revokeRefresh: token has no jti");
      return false;
    }
    await prisma.refreshSession.update({
      where: { id: jti },
      data: { revoked: true },
    });
    if (process.env.NODE_ENV !== "production")
      console.log("Refresh token revoked, session id =", jti);
    return true;
  } catch (error) {
    // Log error for observability. Caller will receive boolean result.
    console.log(
      "Failed to revoke refresh token:",
      error && error.message ? error.message : error
    );
    return false;
  }
};
