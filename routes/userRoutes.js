import express from "express";
import {
  getUsers,
  updateUser,
  deleteUser,
  getUserById,
  testLastLogin,
} from "../controllers/userController.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// All user management routes require ADMIN access
router.get("/users", authenticate, authorize(["ADMIN"]), getUsers);
router.get("/users/:id", authenticate, authorize(["ADMIN"]), getUserById);
router.get(
  "/test-login/:userId",
  authenticate,
  authorize(["ADMIN"]),
  testLastLogin
);
router.patch("/users/:id", authenticate, authorize(["ADMIN"]), updateUser);
router.delete("/users/:id", authenticate, authorize(["ADMIN"]), deleteUser);

export default router;
