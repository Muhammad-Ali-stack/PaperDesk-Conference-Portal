// Central email-sending interface for ConForum.
//
// sendEmail(type, mailOptions) -- the only export callers need.
//
// Supported types:
//   "otp"        -- one-time passwords        (high priority, bypasses queue)
//   "organizer"  -- conference approval/rejection notices
//   "reviewer"   -- paper accepted/rejected notifications
//   "invitation" -- token-based reviewer/organizer invitation links
//   "fallback"   -- catch-all for unrecognised or missing types
//
// Return value: always { sent: boolean, reason?: string }, never throws.

import { getTransporter, getSenderAddress } from "../config/transporters.js";
import { enqueue, queueSize } from "./emailQueue.js";

const OTP_MAX_RETRIES = 2;
const OTP_RETRY_DELAY = 3000; // ms between OTP retry attempts

const VALID_TYPES = new Set(["otp", "organizer", "reviewer", "invitation", "fallback"]);

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves the transporter, injects the From header, and calls nodemailer sendMail.
// Throws on failure so callers can decide whether to retry.
const _doSend = async (type, mailOptions) => {
  const transporter = getTransporter(type);
  if (!transporter) {
    throw new Error(`No transporter for type "${type}" and fallback is also unconfigured.`);
  }

  const from = getSenderAddress(type) || getSenderAddress("fallback");
  if (!from) {
    throw new Error(`No sender address configured for type "${type}".`);
  }

  await transporter.sendMail({
    from: `"ConForum" <${from}>`,
    ...mailOptions,
  });
};

// Sends an email using the transporter mapped to `type`.
//
// OTP emails bypass the queue and are sent inline with their own retry loop.
// All other types are enqueued; the returned promise resolves once the job
// is actually sent (or permanently fails after retries).
//
// mailOptions: { to, subject, html?, text?, cc?, bcc? }
// Returns: Promise<{ sent: boolean, reason?: string }>
export const sendEmail = async (type, mailOptions) => {
  const resolvedType = VALID_TYPES.has(type) ? type : "fallback";

  // OTP: send immediately with inline retries, no queue delay
  if (resolvedType === "otp") {
    let lastError;
    const maxAttempts = OTP_MAX_RETRIES + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await _doSend("otp", mailOptions);
        console.log(`[emailService] OTP sent to "${mailOptions.to}"`);
        return { sent: true };
      } catch (err) {
        lastError = err;
        console.warn(`[emailService] OTP attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
        if (attempt < maxAttempts) await _sleep(OTP_RETRY_DELAY);
      }
    }

    console.error(`[emailService] OTP permanently failed: ${lastError.message}`);
    return { sent: false, reason: lastError.message };
  }

  // Non-OTP: enqueue and return a promise that resolves after the job is processed.
  // The queue handles rate-limiting and up to MAX_RETRIES retries internally.
  return new Promise((resolve) => {
    const task = async () => {
      await _doSend(resolvedType, mailOptions);
      resolve({ sent: true });
    };

    const wrappedTask = async () => {
      try {
        await task();
      } catch (err) {
        // Queue exhausted all retries — surface the final failure
        resolve({ sent: false, reason: err.message });
        throw err; // re-throw so the queue processor can log the permanent failure
      }
    };

    enqueue(wrappedTask, mailOptions.subject || "(no subject)");
    console.log(`[emailService] Queued "${resolvedType}" email — subject: "${mailOptions.subject}", depth: ${queueSize()}`);
  });
};

// Returns true when the transporter for `type` (or its fallback) is configured.
// Useful as a pre-flight check before flows that require email delivery.
export const isEmailReady = (type = "otp") => getTransporter(type) !== null;
