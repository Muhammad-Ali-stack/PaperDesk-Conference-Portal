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
} from "../controller/organizerController.js";
import upload from "../middleware/multer.js";
import { requireLogin, isOrganizerRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── All organizer routes are protected ───────────────────────────────────────

/** POST /assign-papers/:id — Auto-assigns pending papers to reviewers by expertise. */
router.post("/assign-papers/:id", requireLogin, isOrganizerRole, assignPapersToReviewersController);

/** POST /assign-paper-manual — Manually assigns reviewers to a specific paper, with optional due date. */
router.post("/assign-paper-manual", requireLogin, manuallyAssignPaperController);

/** PATCH /assignments/:paperId/due-date — Updates the review due date for all reviewers of a paper. */
router.patch("/assignments/:paperId/due-date", requireLogin, updateAssignmentDueDateController);

/** GET /assigned-papers/:conferenceId — Returns all assignments for a conference. */
router.get("/assigned-papers/:conferenceId", requireLogin, getAssignmentsByConferenceController);

/** GET /review-management/:conferenceId — Returns consolidated review management table. */
router.get("/review-management/:conferenceId", requireLogin, getReviewManagementDataController);

/** GET /reviews/:paperId — Returns all reviews for a specific paper. */
router.get("/reviews/:paperId", requireLogin, getReviewsByPaperIdController);

/** POST /reviews/all-papers — Returns all reviews for a given array of paper IDs. */
router.post("/reviews/all-papers", requireLogin, getReviewsOfAllPapersController);

/** POST /update-decision — Sets the final editorial decision for a paper. */
router.post("/update-decision", requireLogin, updateFinalDecisionController);

/** POST /set-technical-weightage — Sets review criteria weightages for a conference. */
router.post("/set-technical-weightage", requireLogin, setTechnicalWeightageController);

/** GET /get-technical-weightage/:conferenceId — Returns review criteria weightages. */
router.get("/get-technical-weightage/:conferenceId", requireLogin, getTechnicalWeightageController);

/** POST /papers/assigned-reviewers — Returns assignment counts and reviewer details. */
router.post("/papers/assigned-reviewers", requireLogin, getAssignmentsByPaperController);

/** GET /get-proceedings-data/:conferenceId — Returns accepted papers for proceedings. */
router.get("/get-proceedings-data/:conferenceId", requireLogin, fetchAcceptedPapersController);

/** POST /upload-proceedings/:conferenceId — Generates conference proceedings PDF. */
router.post("/upload-proceedings/:conferenceId", requireLogin, upload.single("proceedingsIntro"), proceedingsPdfGenerationController);

/** GET /conferences/:userId — Returns all conferences where the user is an organizer. */
router.get("/conferences/:userId", requireLogin, getOrganizerConferencesController);

export default router;