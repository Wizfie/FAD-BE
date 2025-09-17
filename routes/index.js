import express from "express";
import authRoutes from "./authRoutes.js";
import dataRoutes from "./dataRoutes.js";
import areaRoutes from "./areaRoutes.js";
import photoRoutes from "./photoRouter.js";

const router = express.Router();

router.use(authRoutes);
router.use(dataRoutes);
router.use(areaRoutes);
router.use(photoRoutes);

export default router;
