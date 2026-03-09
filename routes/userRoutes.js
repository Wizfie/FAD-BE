import express from "express";
import {
  getUsers,
  updateUser,
  deleteUser,
  getUserById,
} from "../controllers/userController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import { requireSuperAdmin } from "../middlewares/permission.js";

const router = express.Router();

// All user management routes require SUPER_ADMIN access
router.get("/users", authenticate, requireSuperAdmin, getUsers);
router.get("/users/:id", authenticate, requireSuperAdmin, getUserById);
router.patch("/users/:id", authenticate, requireSuperAdmin, updateUser);
router.delete("/users/:id", authenticate, requireSuperAdmin, deleteUser);

export default router;
