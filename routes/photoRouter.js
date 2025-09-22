import { PhotoController } from "../controllers/photoController.js";
import { Router } from "express";
import { upload } from "../config/multer.js";

const router = Router();

router.post("/photos", upload.array("files", 20), PhotoController.upload);
router.get("/photos", PhotoController.list);
router.delete("/photos/:id", PhotoController.remove);

// Comparison groups
router.post("/comparison-groups", PhotoController.createGroup);
router.get("/comparison-groups", PhotoController.listGroups);
router.get("/comparison-groups/:id", PhotoController.getGroup);
router.put("/comparison-groups/:id", PhotoController.updateGroup);

export default router;
