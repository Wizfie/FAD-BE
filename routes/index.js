import express from "express";
import authRoutes from "./authRoutes.js";
import dataRoutes from "./dataRoutes.js";
import areaRoutes from "./areaRoutes.js";
import photoRoutes from "./photoRouter.js";
import userRoutes from "./userRoutes.js";
import logRoutes from "./logRoutes.js";
import changelogRoutes from "./changelogRoutes.js";

const router = express.Router();

router.use(authRoutes);
router.use(dataRoutes);
router.use(areaRoutes);
router.use(photoRoutes);
router.use(userRoutes);
router.use("/logs", logRoutes);
router.use("/changelog", changelogRoutes);

export default router;
