import rateLimit from "express-rate-limit";
import { Logger } from "../utils/logger.js";

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    Logger.warn("General rate limit exceeded", {
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(options.statusCode).json({ message: options.message });
  },
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, next, options) => {
    Logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get("user-agent"),
    });
    res
      .status(options.statusCode)
      .json({
        message: "Too many authentication attempts, please try again later.",
      });
  },
});

// File upload rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    Logger.warn("Upload rate limit exceeded", {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get("user-agent"),
      userId: req.user?.id,
    });
    res
      .status(options.statusCode)
      .json({ message: "Too many upload attempts, please try again later." });
  },
});
