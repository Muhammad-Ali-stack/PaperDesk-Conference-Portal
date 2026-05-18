import express from "express";
import {
  getAllResearchPapersController,
  getResearchPaperByIdController,
  deletePaperController,
  updatePaperController,
  getUserConferencePapersController,
  checkComplianceController,
  submitPaperController,
  getAuthorConferencesController,
  getSubmissionStatusController,
} from "../controller/authorController.js";
import upload from "../middleware/multer.js";
import { requireLogin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────
// check-compliance is called before login on the public paper submission page
router.post("/check-compliance", upload.single("paper"), checkComplianceController);

// ─── Static protected routes ──────────────────────────────────────────────────
router.post("/submit-paper", requireLogin, upload.single("paper"), submitPaperController);
router.get("/research-paper/:id", requireLogin, getResearchPaperByIdController);
router.get("/all-research-papers", requireLogin, getAllResearchPapersController);
router.put("/update-paper-details/:id", requireLogin, upload.single("paper"), updatePaperController);
router.delete("/delete-paper/:id/:conferenceId", requireLogin, deletePaperController);

// MUST be here — before any /:userId/... dynamic routes
router.get("/conference/:conferenceId/papers/:paperId/submission-status", requireLogin, getSubmissionStatusController);

// ─── Dynamic protected routes ─────────────────────────────────────────────────
// These must come AFTER all static routes because /:userId will greedily
// match any segment — including the word "conference" above.
router.get("/:userId/conferences", requireLogin, getAuthorConferencesController);
router.get("/:userId/:conferenceId/papers", requireLogin, getUserConferencePapersController);

export default router;