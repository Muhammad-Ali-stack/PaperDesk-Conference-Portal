import express from "express";
import {
  getAllResearchPapersController,
  getResearchPaperByIdController,
  deletePaperController,
  updatePaperController,
  getUserConferencePapersController,
  submitPaperController,
  getAuthorConferencesController,
  getSubmissionStatusController,
} from "../controller/authorController.js";
import upload from "../middleware/multer.js";
import { requireLogin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Protected routes ──────────────────────────────────────────────────────────
router.post("/submit-paper", requireLogin, upload.single("paper"), submitPaperController);
router.get("/research-paper/:id", requireLogin, getResearchPaperByIdController);
router.get("/all-research-papers", requireLogin, getAllResearchPapersController);
router.put("/update-paper-details/:id", requireLogin, upload.single("paper"), updatePaperController);
router.delete("/delete-paper/:id/:conferenceId", requireLogin, deletePaperController);

// MUST be here — before any /:userId/... dynamic routes
router.get("/conference/:conferenceId/papers/:paperId/submission-status", requireLogin, getSubmissionStatusController);

// ─── Dynamic protected routes ──────────────────────────────────────────────────
router.get("/:userId/conferences", requireLogin, getAuthorConferencesController);
router.get("/:userId/:conferenceId/papers", requireLogin, getUserConferencePapersController);

export default router;