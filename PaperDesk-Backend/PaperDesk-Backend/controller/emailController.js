import crypto from "crypto";
import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/*
 * Sends reviewer invitation emails for a conference.
 *
 * Each valid email address receives a unique token-based invitation link.
 * The token is stored in the invitations table and used during registration
 * to validate the invite without exposing the email in the URL.
 *
 * Email failures are logged but do NOT abort the invitation flow —
 * the invitation record is always stored in the database regardless.
 */
export const sendInvitationController = async (req, res) => {
  const { reviewerEmails, conferenceId, conferenceName, additionalMessage } = req.body;

  try {
    if (!reviewerEmails || reviewerEmails.length === 0) {
      return res.status(400).json({ message: "No email addresses provided." });
    }

    const results = [];

    for (const email of reviewerEmails) {
      if (!isValidEmail(email)) {
        results.push({ email, success: false, reason: "Invalid email address" });
        continue;
      }

      const inviteToken = crypto.randomUUID();

      const inviteLink = `${process.env.BASE_URL}/login?role=reviewer&token=${inviteToken}&conferenceId=${conferenceId}&conferenceName=${encodeURIComponent(conferenceName)}`;

      await supabase
        .from("invitations")
        .insert({ email, conference_id: conferenceId, role: "reviewer", status: "pending", token: inviteToken });

      const { sent } = await sendMail({
        type: "organizer",
        to: email,
        subject: `Reviewer Invitation — ${conferenceName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2 style="color: #4B707A;">Invitation to Review for ${conferenceName}</h2>
            <p>You have been invited to join as a reviewer for <strong>${conferenceName}</strong>.</p>
            ${additionalMessage ? `<p>${additionalMessage}</p>` : ""}
            <p>Click the link below to respond to the invitation:</p>
            <a href="${inviteLink}" style="display:inline-block; margin-top:10px; padding:8px 16px; color:white; background-color:#4B707A; border-radius:5px; text-decoration:none;">
              Respond to Invitation
            </a>
            <p style="margin-top:20px;">Thank you,<br>The ${conferenceName} Team</p>
          </div>
        `,
      });

      results.push({ email, success: true, emailSent: sent });
    }

    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      return res.status(400).json({ message: "All invitations failed due to invalid emails.", results });
    }

    return res.status(200).json({
      message: "Invitations processed successfully.",
      results,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error sending invitations.",
      error: error.message,
    });
  }
};
