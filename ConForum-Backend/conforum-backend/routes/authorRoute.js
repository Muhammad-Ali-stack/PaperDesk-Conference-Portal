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

const router = express.Router();

// ─── Static routes first ─────────────────────────────────────────────────────
router.post("/check-compliance", upload.single("paper"), checkComplianceController);
router.post("/submit-paper", upload.single("paper"), submitPaperController);
router.get("/research-paper/:id", getResearchPaperByIdController);
router.get("/all-research-papers", getAllResearchPapersController);
router.put("/update-paper-details/:id", upload.single("paper"), updatePaperController);
router.delete("/delete-paper/:id/:conferenceId", deletePaperController);

// MUST be here — before any /:userId/... dynamic routes
router.get("/conference/:conferenceId/papers/:paperId/submission-status", getSubmissionStatusController);

// ─── Dynamic routes last ──────────────────────────────────────────────────────
// These must come AFTER all static routes because /:userId will greedily
// match any segment — including the word "conference" above.
router.get("/:userId/conferences", getAuthorConferencesController);
router.get("/:userId/:conferenceId/papers", getUserConferencePapersController);

export default router;