import express from "express";
import authRoutes from "./authRoutes.js";
import dataRoutes from "./dataRoutes.js";

const router = express.Router();

router.use(authRoutes);
router.use(dataRoutes);

export default router;
