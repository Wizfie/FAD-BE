/**
 * Middleware untuk handle express-validator validation errors
 * Mengkonversi validation errors menjadi ApiError
 */
import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

/**
 * Middleware untuk check & throw validation errors
 * Letakkan setelah validator di route, sebelum controller
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const firstError = errorArray[0];

    // Collect semua validation errors untuk meta
    const validationDetails = errorArray.map((err) => ({
      field: err.param,
      message: err.msg,
      value: err.value,
    }));

    throw ApiError.badRequest(
      firstError.msg || "Validation failed",
      "VALIDATION_ERROR",
      {
        errors: validationDetails,
      }
    );
  }

  next();
};

/**
 * Async wrapper untuk controller agar catch error otomatis
 * Gunakan jika tidak ada global async error handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
