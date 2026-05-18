import express from "express";
import {
  createConferenceController,
  getConferenceController,
  getAllConferencesController,
  updateConferenceController,
  deleteConferenceController,
  getApprovedConferencesController,
  rejectConferenceController,
  approveConferenceController,
  getPendingConferencesController,
  getRejectedConferencesController,
  getConferenceByAcronymController,
  getPapersByConferenceController,
  sendOrganizerInviteController,
  setMaxResubmissionsController,
  getSubmissionStatusController,
} from "../controller/conferenceController.js";
import {
  requireLogin,
  isAdmin,
  isOrganizerRole,
} from "../middleware/authMiddleware.js";
import supabase from "../config/supabase.js";

const router = express.Router();

// ─── Public routes (no auth required) ────────────────────────────────────────

/** GET /all-conferences — Public conference listing. */
router.get("/all-conferences", getApprovedConferencesController);

// ─── Protected routes ─────────────────────────────────────────────────────────

/**
 * POST /create-conference
 * Admins (role === 1) and organizers only.
 */
router.post("/create-conference", requireLogin, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { data: user } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === 1) return next();
    return isOrganizerRole(req, res, next);
  } catch (error) {
    return res.status(500).json({ message: "Authorization error." });
  }
}, createConferenceController);

/** POST /send-invite — Admin only. */
router.post("/send-invite", requireLogin, isAdmin, sendOrganizerInviteController);

/** GET /get-conference/:id — Protected: used by organizer/author dashboards. */
router.get("/get-conference/:id", requireLogin, getConferenceController);

/** GET /rejected-conferences — Admin only. */
router.get("/rejected-conferences", requireLogin, isAdmin, getRejectedConferencesController);

/** GET /all-reg-conferences — Admin only. */
router.get("/all-reg-conferences", requireLogin, isAdmin, getAllConferencesController);

/** GET /pending — Admin only. */
router.get("/pending", requireLogin, isAdmin, getPendingConferencesController);

/** PUT /approve/:id — Admin only. */
router.put("/approve/:id", requireLogin, isAdmin, approveConferenceController);

/** PUT /reject/:id — Admin only. */
router.put("/reject/:id", requireLogin, isAdmin, rejectConferenceController);

/** PUT /update-conference/:id — Organizer only. */
router.put("/update-conference/:id", requireLogin, isOrganizerRole, updateConferenceController);

/** DELETE /delete-conference/:id — Admin only. */
router.delete("/delete-conference/:id", requireLogin, isAdmin, deleteConferenceController);

/**
 * PUT /:id/max-resubmissions
 * Admin or the conference's own organizer only.
 */
router.put("/:id/max-resubmissions", requireLogin, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { data: user } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === 1) return next();
    const { data: conference } = await supabase
      .from("conferences")
      .select("organizer_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (conference && conference.organizer_id === userId) return next();
    return res.status(403).json({ message: "Only the admin or the conference organizer can set the resubmission limit." });
  } catch (error) {
    return res.status(500).json({ message: "Authorization error." });
  }
}, setMaxResubmissionsController);

/** GET /:conferenceId/papers/:paperId/submission-status */
router.get("/:conferenceId/papers/:paperId/submission-status", requireLogin, getSubmissionStatusController);

/** GET /:conferenceId/papers — Organizer dashboard. */
router.get("/:conferenceId/papers", requireLogin, getPapersByConferenceController);

// ─── Wildcard route LAST (must always be at the bottom) ──────────────────────

/** GET /:acronym — Public: resolves conference name from acronym (paper submission page). */
router.get("/:acronym", getConferenceByAcronymController);

export default router;