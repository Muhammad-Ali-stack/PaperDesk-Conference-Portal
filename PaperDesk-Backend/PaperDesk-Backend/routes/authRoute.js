import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerController,
  loginController,
  verifyOtpController,
  refreshTokenController,
  logoutController,
  logoutAllDevicesController,
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

// ── Rate limiters ──────────────────────────────────────────────────────────────

/** General auth rate limiter: 15 requests per 15 minutes. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Strict OTP request limiter: 5 OTP sends per 10 minutes per IP. */
const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many OTP requests. Please wait before requesting another code." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** OTP verify limiter: 10 attempts per 10 minutes per IP. */
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many verification attempts. Please request a new code." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public routes ──────────────────────────────────────────────────────────────

router.post("/register", authLimiter, registerController);

/**
 * POST /api/auth/login
 * Step 1 of the auth flow.
 * - Checks for a valid refresh token cookie → if trusted device, returns access token directly.
 * - Otherwise sends an OTP to the user's email.
 * Body: { email, [role], [conferenceId], [invitationToken], [expertise] }
 */
router.post("/login", otpRequestLimiter, loginController);

/**
 * POST /api/auth/verify-otp
 * Step 2 of the auth flow (first-time / new device only).
 * Validates the hashed OTP, issues a 15-min access token, sets
 * a 30-day HttpOnly refresh token cookie, and records the trusted device.
 * Body: { userId, otp }
 */
router.post("/verify-otp", otpVerifyLimiter, verifyOtpController);

/**
 * POST /api/auth/refresh
 * Silent re-authentication for trusted devices.
 * Reads the refresh token from the HttpOnly cookie, validates it against
 * trusted_devices, rotates the refresh token, and returns a new 15-min
 * access token. No OTP required.
 * Body: { userId }
 */
router.post("/refresh", authLimiter, refreshTokenController);

/**
 * POST /api/auth/logout
 * Normal logout: clears the refresh token cookie but preserves the
 * trusted_devices record so the next login from the same device is seamless.
 */
router.post("/logout", logoutController);

/**
 * POST /api/auth/logout-all
 * Logout from all devices: deletes ALL trusted_devices records for the
 * authenticated user and clears the cookie. OTP will be required on the
 * next login from every device.
 * Requires: valid access token (Bearer).
 */
router.post("/logout-all", requireLogin, logoutAllDevicesController);


router.get("/invitation/:token", getInvitationByTokenController);

// ── Protected routes ───────────────────────────────────────────────────────────

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
