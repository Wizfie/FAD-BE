import express from "express";
import {
  loginController,
  registerController,
  refreshController,
  logoutController,
  meController,
} from "../controllers/authController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/refresh", refreshController);
router.post("/logout", authenticate, logoutController);

router.get("/me", authenticate, meController);
router.get("/admin", authenticate, authorize(["ADMIN"])),
  (req, res) => {
    res.json({
      msg: "you are logged in as admin",
    });
  };

export default router;
