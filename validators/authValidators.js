/**
 * Validators untuk Auth routes
 * Menggunakan express-validator untuk input validation
 * Letakkan validator di route sebelum controller
 */
import { body } from "express-validator";

/**
 * Validator untuk register endpoint
 * POST /api/auth/register
 */
export const validateRegister = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username wajib diisi")
    .bail()
    .isLength({ min: 3 })
    .withMessage("Username minimal 3 karakter")
    .bail()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Username hanya boleh huruf, angka, underscore, atau dash"),

  body("password")
    .notEmpty()
    .withMessage("Password wajib diisi")
    .bail()
    .isLength({ min: 4 })
    .withMessage("Password minimal 4 karakter"),

  body("email")
    .if(body("email").exists({ checkFalsy: true }))
    .trim()
    .isEmail()
    .withMessage("Format email tidak valid"),

  body("role")
    .if(body("role").exists({ checkFalsy: true }))
    .isIn(["USER", "ADMIN", "SUPER_ADMIN"])
    .withMessage("Role hanya boleh USER, ADMIN, atau SUPER_ADMIN"),

  body("modules")
    .if((value, { req }) => req.body.role && req.body.role !== "SUPER_ADMIN")
    .isArray({ min: 1 })
    .withMessage("Minimal 1 module harus dipilih untuk non-SUPER_ADMIN users")
    .custom((modules) => {
      if (
        !Array.isArray(modules) ||
        modules.some((m) => typeof m !== "string")
      ) {
        throw new Error("Modules harus array of strings");
      }
      return true;
    }),

  body("status")
    .if(body("status").exists({ checkFalsy: true }))
    .isIn(["ACTIVE", "INACTIVE"])
    .withMessage("Status hanya boleh ACTIVE atau INACTIVE"),
];

/**
 * Validator untuk login endpoint
 * POST /api/auth/login
 */
export const validateLogin = [
  body("username").trim().notEmpty().withMessage("Username wajib diisi"),

  body("password").notEmpty().withMessage("Password wajib diisi"),
];

/**
 * Validator untuk refresh token endpoint
 * POST /api/auth/refresh
 * Token dibaca dari httpOnly cookie, tidak dari body.
 */
export const validateRefresh = [];

/**
 * Validator untuk logout endpoint
 * POST /api/auth/logout
 */
