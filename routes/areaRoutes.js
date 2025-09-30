import express from "express";
import { AreaController } from "../controllers/areaController.js";

const router = express.Router();

router.get("/areas", AreaController.list);
router.post("/areas", AreaController.create);
router.put("/areas/:id", AreaController.update);
router.delete("/areas/:id", AreaController.delete);

export default router;
