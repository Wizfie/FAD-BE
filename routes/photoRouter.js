import { PhotoController } from "../controllers/photoController.js";
import { Router } from "express";
import { upload } from "../config/multer.js";

const router = Router();

router.post("/photos", upload.array("files", 20), PhotoController.upload);
router.get("/photos", PhotoController.list);
router.delete("/photos/:id", PhotoController.remove);

export default router;
