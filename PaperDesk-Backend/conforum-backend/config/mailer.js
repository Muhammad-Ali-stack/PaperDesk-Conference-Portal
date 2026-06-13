// Backward-compatible wrapper around the Gmail emailService.
//
// All existing controllers call sendMail({ type, to, subject, html }).
// This module translates legacy type names to the five canonical types
// used by emailService.js, then delegates transparently.
//
// Legacy type -> Canonical type -> Gmail account
//   "otp"       -> "otp"         -> GMAIL_OTP_USER        (login codes)
//   "organizer" -> "invitation"  -> GMAIL_INVITATION_USER  (reviewer invites)
//   "admin"     -> "organizer"   -> GMAIL_ORGANIZER_USER   (conference decisions)
//   "paper"     -> "reviewer"    -> GMAIL_REVIEWER_USER    (paper status notices)
//   "fallback"  -> "fallback"    -> GMAIL_FALLBACK_USER

import { sendEmail, isEmailReady as _isEmailReady } from "../services/emailService.js";

const TYPE_MAP = {
  otp:       "otp",
  organizer: "invitation",
  admin:     "organizer",
  paper:     "reviewer",
  fallback:  "fallback",
};

const _resolveType = (type) => TYPE_MAP[type] ?? "fallback";

// Drop-in replacement for the old Brevo sendMail.
// Never throws — always returns { sent: boolean, reason?: string }.
export const sendMail = async ({ type = "fallback", to, subject, html, text }) => {
  return sendEmail(_resolveType(type), { to, subject, html, text });
};

// Fire-and-forget wrapper. Use when the HTTP response does not depend on delivery.
export const sendMailQuiet = (opts) => {
  sendMail(opts).catch((err) =>
    console.error("[mailer] sendMailQuiet error:", err.message)
  );
};

// Returns true when the OTP transporter is configured.
// Backward-compatible with the original Brevo version.
export const isEmailReady = () => _isEmailReady("otp");
