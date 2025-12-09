/**
 * Program Info Routes - API endpoints untuk gambar Program 5R
 */
import express from "express";
import { upload } from "../config/multer.js";
import { ProgramInfoController } from "../controllers/ProgramInfoController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Get all program info images (semua role yang sudah login)
router.get("/program-info", authenticate, ProgramInfoController.getAll);

// Upload program info image (admin only)
router.post(
  "/program-info",
  authenticate,
  authorize(["ADMIN"]),
  upload.single("image"),
  ProgramInfoController.upload
);

// Delete program info image (admin only)
router.delete(
  "/program-info/:id",
  authenticate,
  authorize(["ADMIN"]),
  ProgramInfoController.remove
);

// Update display order (admin only)
router.put(
  "/program-info/order",
  authenticate,
  authorize(["ADMIN"]),
  ProgramInfoController.updateOrder
);

export default router;
