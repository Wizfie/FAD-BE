/**
 * Middleware untuk handling error multer
 */
export const multerErrorHandler = (err, req, res, next) => {
  // Handle Multer errors specifically
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "File terlalu besar. Maksimal 5MB per file.",
      code: "FILE_TOO_LARGE",
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      message: "Terlalu banyak file. Maksimal 20 file per upload.",
      code: "TOO_MANY_FILES",
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      message: "Field file tidak sesuai format yang diharapkan.",
      code: "INVALID_FILE_FIELD",
    });
  }

  // Handle file format errors from multer fileFilter
  if (err.message && err.message.includes("format file tidak diizinkan")) {
    return res.status(400).json({
      message: "Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau HEIC.",
      code: "INVALID_FILE_FORMAT",
    });
  }

  // Jika bukan multer error, lanjutkan ke error handler berikutnya
  next(err);
};
