import express from "express";
import {
  reviewerRegisterController,
  reviewerLoginController,
  checkReviewerDetailsController,
  getAcceptedReviewersController,
  respondToInvitationController,
  getAssignedPapersForReviewerController,
  submitReviewFormController,
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
// GET /assigned-papers/reviewer/:reviewerId must be registered before
// GET /:conferenceId/reviewers — otherwise Express matches "assigned-papers"
// as the :conferenceId value and this handler is never reached.
router.get(
  "/assigned-papers/reviewer/:reviewerId",
  requireLogin,
  getAssignedPapersForReviewerController
);

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