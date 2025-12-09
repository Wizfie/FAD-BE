import rateLimit from "express-rate-limit";
import { Logger } from "../utils/Logger.js";

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: async (req, res, options) => {
    await Logger.suspiciousActivity(
      "RATE_LIMIT_EXCEEDED",
      {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
        severity: "medium",
      },
      req
    );
  },
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  onLimitReached: (req, res, options) => {
    securityLogger.logSuspiciousActivity(
      "AUTH_RATE_LIMIT_EXCEEDED",
      {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
        severity: "high",
      },
      req
    );
    Logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get("user-agent"),
    });
  },
});

// File upload rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 uploads per windowMs
  message: "Too many upload attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    securityLogger.logSuspiciousActivity(
      "UPLOAD_RATE_LIMIT_EXCEEDED",
      {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
        userId: req.user?.id,
        severity: "medium",
      },
      req
    );
    Logger.warn("Upload rate limit exceeded", {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get("user-agent"),
      userId: req.user?.id,
    });
  },
});
