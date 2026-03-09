import express from "express";
import {
  loginController,
  registerController,
  refreshController,
  logoutController,
  meController,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import {
  validateRegister,
  validateLogin,
  validateRefresh,
} from "../validators/authValidators.js";
import { handleValidationErrors } from "../middlewares/validateSchema.js";
import { authLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  validateRegister,
  handleValidationErrors,
  registerController,
);
router.post(
  "/login",
  authLimiter,
  validateLogin,
  handleValidationErrors,
  loginController,
);
router.post(
  "/refresh",
  authLimiter,
  validateRefresh,
  handleValidationErrors,
  refreshController,
);
router.post("/logout", logoutController);

router.get("/me", authenticate, meController);

export default router;
