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
} from "../controller/organizerController.js";
import upload from "../middleware/multer.js";
import { getOrganizerConferencesController } from "../controller/organizerController.js";

const router = express.Router();

/** POST /assign-papers/:id — Auto-assigns pending papers to available reviewers by expertise. */
router.post("/assign-papers/:id", assignPapersToReviewersController);

/** POST /assign-paper-manual — Manually assigns one or more reviewers to a specific paper. */
router.post("/assign-paper-manual", manuallyAssignPaperController);

/** GET /assigned-papers/:conferenceId — Returns all reviewer assignments for a conference. */
router.get("/assigned-papers/:conferenceId", getAssignmentsByConferenceController);

/** GET /review-management/:conferenceId — Returns the consolidated review management table. */
router.get("/review-management/:conferenceId", getReviewManagementDataController);

/** GET /reviews/:paperId — Returns all reviews submitted for a specific paper. */
router.get("/reviews/:paperId", getReviewsByPaperIdController);

/** POST /reviews/all-papers — Returns all reviews for a given array of paper IDs. */
router.post("/reviews/all-papers", getReviewsOfAllPapersController);

/** POST /update-decision — Sets the final editorial decision for a paper. */
router.post("/update-decision", updateFinalDecisionController);

/** POST /set-technical-weightage — Sets or updates review criteria weightages for a conference. */
router.post("/set-technical-weightage", setTechnicalWeightageController);

/** GET /get-technical-weightage/:conferenceId — Returns the review criteria weightages. */
router.get("/get-technical-weightage/:conferenceId", getTechnicalWeightageController);

/** POST /papers/assigned-reviewers — Returns assignment counts and reviewer details for a set of papers. */
router.post("/papers/assigned-reviewers", getAssignmentsByPaperController);

/** GET /get-proceedings-data/:conferenceId — Returns all accepted papers for proceedings generation. */
router.get("/get-proceedings-data/:conferenceId", fetchAcceptedPapersController);

/**
 * POST /upload-proceedings/:conferenceId
 * Accepts an optional intro PDF via multipart upload and generates the
 * conference proceedings PDF from all accepted papers.
 */
router.post("/upload-proceedings/:conferenceId", upload.single("proceedingsIntro"), proceedingsPdfGenerationController);

/** GET /conferences/:userId — Returns all conferences where the user is an organizer. */
router.get("/conferences/:userId", getOrganizerConferencesController);

export default router;
