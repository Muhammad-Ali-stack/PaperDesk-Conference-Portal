import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerController,
  loginController,
  verifyOtpController,
  forgotPasswordController,
  updateProfileController,
  getUserRolesController,
  getUserConferencesByRole,
  getInvitationByTokenController,
} from "../controller/authController.js";
import {
  requireLogin,
  isAdmin,
  isOrganizer,
  isReviewer,
  isAuthor,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Rate limiter: 10 requests per 15 minutes for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter to authentication endpoints
router.post("/register", authLimiter, registerController);
router.post("/login", authLimiter, loginController);
router.post("/verify-otp", authLimiter, verifyOtpController);
router.post("/forgot-password", authLimiter, forgotPasswordController);
router.get("/invitation/:token", getInvitationByTokenController);

router.get("/user-auth", requireLogin, (req, res) => {
  res.status(200).json({ ok: true });
});

router.get("/admin-auth", requireLogin, isAdmin, (req, res) => {
  res.status(200).json({ ok: true });
});

router.get("/organizer-dashboard/:conferenceId", isOrganizer, (req, res) => {
  res.status(200).json({ message: "Welcome to the Organizer Dashboard." });
});

router.get("/reviewer-dashboard/:conferenceId", isReviewer, (req, res) => {
  res.status(200).json({ message: "Welcome to the Reviewer Dashboard." });
});

router.get("/author-dashboard/:conferenceId", isAuthor, (req, res) => {
  res.status(200).json({ message: "Welcome to the Author Dashboard." });
});

router.put("/profile", requireLogin, updateProfileController);
router.get("/user-roles/:userId", getUserRolesController);
router.get("/conferences/:userId", getUserConferencesByRole);
router.get("/user-conferences/:userId", getUserConferencesByRole); 
export default router;