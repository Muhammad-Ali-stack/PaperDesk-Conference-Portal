import nodemailer from "nodemailer";

// Creates one Gmail SMTP transporter per email purpose.
// Each account must use a Gmail App Password, not the account password.
// App Passwords: myaccount.google.com > Security > 2-Step Verification > App passwords

const _build = (user, pass, label) => {
  if (!user || !pass) {
    console.warn(`[transporters] Missing credentials for "${label}" — emails of this type will not be sent.`);
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,           // reuse SMTP connections across sends
    maxConnections: 3,    // respect Gmail's per-account concurrent connection limit
    maxMessages: 50,      // recycle a connection after 50 messages
  });
};

// Five transporters, one per Gmail account.
// A null entry means unconfigured; emailService falls back to "fallback" automatically.
const transporters = {
  // Conference approval/rejection notices sent to organizers
  organizer: _build(process.env.GMAIL_ORGANIZER_USER, process.env.GMAIL_ORGANIZER_PASS, "organizer"),

  // Paper accepted/rejected notifications sent to authors
  reviewer: _build(process.env.GMAIL_REVIEWER_USER, process.env.GMAIL_REVIEWER_PASS, "reviewer"),

  // Token-based reviewer/organizer invitation links
  invitation: _build(process.env.GMAIL_INVITATION_USER, process.env.GMAIL_INVITATION_PASS, "invitation"),

  // One-time passwords for login — high priority, bypasses send queue
  otp: _build(process.env.GMAIL_OTP_USER, process.env.GMAIL_OTP_PASS, "otp"),

  // Catch-all used when a specific transporter is unavailable
  fallback: _build(process.env.GMAIL_FALLBACK_USER, process.env.GMAIL_FALLBACK_PASS, "fallback"),
};

// Returns the transporter for the given type, or falls back to "fallback".
// Returns null only if both the requested type and fallback are unconfigured.
export const getTransporter = (type) => transporters[type] || transporters.fallback || null;

// Returns the sender Gmail address for a given type.
// Used to populate the From header automatically.
export const getSenderAddress = (type) => {
  const addresses = {
    organizer:  process.env.GMAIL_ORGANIZER_USER,
    reviewer:   process.env.GMAIL_REVIEWER_USER,
    invitation: process.env.GMAIL_INVITATION_USER,
    otp:        process.env.GMAIL_OTP_USER,
    fallback:   process.env.GMAIL_FALLBACK_USER,
  };
  return addresses[type] || addresses.fallback || null;
};

export default transporters;
