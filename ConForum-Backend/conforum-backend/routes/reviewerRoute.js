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
import { checkIfReviewed } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register-reviewer", reviewerRegisterController);
router.post("/login-reviewer", reviewerLoginController);
router.post("/check-reviewer-details", checkReviewerDetailsController);
router.get("/:conferenceId/reviewers", getAcceptedReviewersController);
router.post("/respond-invitation", respondToInvitationController);
router.get("/assigned-papers/reviewer/:reviewerId", getAssignedPapersForReviewerController);
router.post("/submit-reviewform", checkIfReviewed, submitReviewFormController);

export default router;
