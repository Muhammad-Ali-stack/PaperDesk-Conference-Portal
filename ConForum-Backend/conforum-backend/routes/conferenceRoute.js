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

/**
 * POST /create-conference
 * Accessible by admins (role === 1) and organizers (any conference).
 * Admins bypass the organizer role check; all others are validated via isOrganizerRole.
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

/** POST /send-invite — Admin only. Sends an organizer invitation email. */
router.post("/send-invite", requireLogin, isAdmin, sendOrganizerInviteController);

/**
 * PUT /:id/max-resubmissions
 * Sets the per-paper resubmission limit for a conference.
 * Accessible by the admin (role === 1) or the conference's own organizer.
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

/** GET /get-conference/:id — Returns a single conference with its papers. */
router.get("/get-conference/:id", getConferenceController);

/** GET /all-conferences — Returns all approved conferences. */
router.get("/all-conferences", getApprovedConferencesController);

/** GET /rejected-conferences — Returns all rejected conferences. */
router.get("/rejected-conferences", getRejectedConferencesController);

/** GET /all-reg-conferences — Returns every conference regardless of status. */
router.get("/all-reg-conferences", getAllConferencesController);

/** PUT /update-conference/:id — Updates specified fields of a conference. */
router.put("/update-conference/:id", updateConferenceController);

/** DELETE /delete-conference/:id — Permanently deletes a conference. */
router.delete("/delete-conference/:id", deleteConferenceController);

/** PUT /approve/:id — Admin only. Approves a pending conference. */
router.put("/approve/:id", approveConferenceController);

/** PUT /reject/:id — Admin only. Rejects a pending conference. */
router.put("/reject/:id", rejectConferenceController);

/** GET /pending — Returns all conferences awaiting admin approval. */
router.get("/pending", getPendingConferencesController);

/**
 * GET /:conferenceId/papers/:paperId/submission-status
 * Returns resubmission quota info for a specific paper. Requires login.
 */
router.get("/:conferenceId/papers/:paperId/submission-status", requireLogin, getSubmissionStatusController);

/** GET /:conferenceId/papers — Returns all papers for a conference with reviewer status. */
router.get("/:conferenceId/papers", getPapersByConferenceController);

/** GET /:acronym — Returns the conference name for a given acronym (public). */
router.get("/:acronym", getConferenceByAcronymController);

export default router;
