// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { Logger } from "../utils/Logger.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

// Middleware untuk cek token dan set req.user
export const authenticate = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    await Logger.suspiciousActivity(
      "AUTH_NO_TOKEN",
      {
        endpoint: req.path,
        method: req.method,
        severity: "medium",
      },
      req
    );
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const userId = decoded.sub;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      await Logger.suspiciousActivity(
        "AUTH_USER_NOT_FOUND",
        {
          userId,
          endpoint: req.path,
          severity: "high",
        },
        req
      );
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status !== "ACTIVE") {
      await Logger.suspiciousActivity(
        "AUTH_INACTIVE_USER",
        {
          userId: user.id,
          username: user.username,
          status: user.status,
          endpoint: req.path,
          severity: "medium",
        },
        req
      );
      return res.status(403).json({ error: "User not active" });
    }

    await Logger.debug("User authenticated successfully", {
      userId: user.id,
      username: user.username,
      endpoint: req.path,
    });

    req.user = user;
    next();
  } catch (error) {
    await Logger.suspiciousActivity(
      "AUTH_INVALID_TOKEN",
      {
        error: error.message,
        endpoint: req.path,
        severity: "high",
      },
      req
    );
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware untuk cek role
export const authorize = (roles = []) => {
  return async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      await Logger.unauthorizedAccess(req.path, req.user, req.ip);
      await Logger.warn("Authorization failed", {
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.path,
      });
      return res.status(403).json({ error: "Access denied" });
    }

    await Logger.debug("User authorized", {
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: req.path,
    });

    next();
  };
};
