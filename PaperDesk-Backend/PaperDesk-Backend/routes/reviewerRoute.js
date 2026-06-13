import express from "express";
import {
  reviewerRegisterController,
  reviewerLoginController,
  checkReviewerDetailsController,
  getAcceptedReviewersController,
  respondToInvitationController,
  getAssignedPapersForReviewerController,
  submitReviewFormController,
  getPlagiarismScoreForPaperController,   // <-- ADD THIS IMPORT
} from "../controller/reviewerController.js";
import { requireLogin, checkIfReviewed } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.post("/register-reviewer", reviewerRegisterController);
router.post("/login-reviewer", reviewerLoginController);
router.post("/check-reviewer-details", checkReviewerDetailsController);
router.post("/respond-invitation", respondToInvitationController);

// ─── Protected routes ─────────────────────────────────────────────────────────
// IMPORTANT: static segments must come before dynamic /:param segments.

// Route for fetching plagiarism score (static path)
router.get(
  "/paper/:paperId/plagiarism-score",
  requireLogin,
  getPlagiarismScoreForPaperController
);

// Static: /assigned-papers/reviewer/:reviewerId
router.get(
  "/assigned-papers/reviewer/:reviewerId",
  requireLogin,
  getAssignedPapersForReviewerController
);

// Dynamic: /:conferenceId/reviewers — must come AFTER static routes
router.get(
  "/:conferenceId/reviewers",
  requireLogin,
  getAcceptedReviewersController
);

router.post(
  "/submit-reviewform",
  requireLogin,
  checkIfReviewed,
  submitReviewFormController
);

export default router;