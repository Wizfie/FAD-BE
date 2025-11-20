import { PhotoController } from "../controllers/photoController.js";
import { Router } from "express";
import { upload } from "../config/multer.js";
import { multerErrorHandler } from "../middlewares/multerErrorHandler.js";

const router = Router();

router.post(
  "/photos",
  upload.array("files", 3),
  multerErrorHandler,
  PhotoController.upload
);
router.get("/photos", PhotoController.list);
router.put("/photos/:id", PhotoController.update);
router.delete("/photos/:id", PhotoController.remove);

// Comparison groups
router.post("/comparison-groups", PhotoController.createGroup);
router.get("/comparison-groups", PhotoController.listGroups);
router.get("/comparison-groups/:id", PhotoController.getGroup);
router.put("/comparison-groups/:id", PhotoController.updateGroup);
router.delete("/comparison-groups/:id", PhotoController.deleteGroup);

export default router;
