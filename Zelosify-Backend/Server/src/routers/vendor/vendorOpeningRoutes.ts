import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import {
  fetchVendorOpeningDetails,
  fetchVendorOpenings,
  presignVendorProfileUploads,
  previewVendorProfile,
  softDeleteVendorProfile,
  submitVendorProfiles,
} from "../../controllers/vendor/openings/vendorOpeningController.js";

const router = Router();

router.use(
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler
);

router.get("/", fetchVendorOpenings as RequestHandler);
router.get("/:id", fetchVendorOpeningDetails as RequestHandler);
router.post(
  "/:id/profiles/presign",
  presignVendorProfileUploads as RequestHandler
);
router.post("/:id/profiles/upload", submitVendorProfiles as RequestHandler);
router.delete(
  "/:openingId/profiles/:profileId",
  softDeleteVendorProfile as RequestHandler
);
router.get(
  "/:openingId/profiles/:profileId/preview",
  previewVendorProfile as RequestHandler
);

export default router;
