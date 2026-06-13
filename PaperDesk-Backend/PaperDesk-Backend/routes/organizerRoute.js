import express from "express";
import {
  assignPapersToReviewersController,
  getAssignmentsByConferenceController,
  getReviewManagementDataController,
  getReviewsByPaperIdController,
  updateFinalDecisionController,
  manuallyAssignPaperController,
  setTechnicalWeightageController,
  getTechnicalWeightageController,
  getAssignmentsByPaperController,
  getReviewsOfAllPapersController,
  fetchAcceptedPapersController,
  proceedingsPdfGenerationController,
  getOrganizerConferencesController,
  updateAssignmentDueDateController,
  savePlagiarismScoreController,         // ← added
} from "../controller/organizerController.js";
import upload from "../middleware/multer.js";
import { requireLogin, isOrganizerRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── All organizer routes are protected ───────────────────────────────────────

router.post("/assign-papers/:id", requireLogin, isOrganizerRole, assignPapersToReviewersController);
router.post("/assign-paper-manual", requireLogin, manuallyAssignPaperController);
router.patch("/assignments/:paperId/due-date", requireLogin, updateAssignmentDueDateController);
router.get("/assigned-papers/:conferenceId", requireLogin, getAssignmentsByConferenceController);
router.get("/review-management/:conferenceId", requireLogin, getReviewManagementDataController);
router.get("/reviews/:paperId", requireLogin, getReviewsByPaperIdController);
router.post("/reviews/all-papers", requireLogin, getReviewsOfAllPapersController);
router.post("/update-decision", requireLogin, updateFinalDecisionController);
router.post("/set-technical-weightage", requireLogin, setTechnicalWeightageController);
router.get("/get-technical-weightage/:conferenceId", requireLogin, getTechnicalWeightageController);
router.post("/papers/assigned-reviewers", requireLogin, getAssignmentsByPaperController);
router.get("/get-proceedings-data/:conferenceId", requireLogin, fetchAcceptedPapersController);
router.post("/upload-proceedings/:conferenceId", requireLogin, upload.single("proceedingsIntro"), proceedingsPdfGenerationController);
router.get("/conferences/:userId", requireLogin, getOrganizerConferencesController);

/** POST /save-plagiarism-score — Saves or updates the plagiarism score for a paper. */
router.post("/save-plagiarism-score", requireLogin, savePlagiarismScoreController);  // ← added

export default router;