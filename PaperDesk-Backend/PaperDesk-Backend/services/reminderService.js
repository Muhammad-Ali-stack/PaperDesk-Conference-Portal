/**
 * reminderService.js
 *
 * Background job that runs every hour and sends a reminder email to every
 * reviewer whose paper review is due within the next 48 hours and who has
 * not yet submitted a review.
 *
 * De-duplication: once a reminder has been sent for an assignment,
 * assignments.reminder_sent is set to TRUE so the reviewer never receives
 * a duplicate reminder for the same assignment.
 */

import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REMINDER_WINDOW_HOURS = 48;

const buildReminderHtml = ({ reviewerName, paperTitle, conferenceName, dueDate, paperLink }) => {
  const formattedDue = new Date(dueDate).toUTCString();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#4B707A;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">PaperDesk</h1>
              <p style="margin:6px 0 0;color:#d1e8eb;font-size:13px;">Conference Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 8px;color:#c0392b;font-size:22px;font-weight:700;">&#9203; Review Deadline Reminder</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                Dear ${reviewerName || "Reviewer"},<br/><br/>
                This is a reminder that your review for the following paper is due in less than <strong>48 hours</strong>.
                Please log in to the portal and complete your review before the deadline.
              </p>
              <div style="background-color:#fff8f0;border:1px solid #fde8c8;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:0.5px;">Paper Details</p>
                <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Title:</strong> ${paperTitle}</p>
                <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Conference:</strong> ${conferenceName}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Review Due:</strong> ${formattedDue}</p>
              </div>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${paperLink}"
                   style="display:inline-block;background-color:#4B707A;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                  Review Paper Now
                </a>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                If the button does not work, copy and paste this link into your browser:<br/>
                <a href="${paperLink}" style="color:#4B707A;">${paperLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PaperDesk &mdash; Conference Management System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const runReminderCheck = async () => {
  try {
    if (!supabase) {
      console.warn("[reminderService] Supabase not configured — skipping reminder check.");
      return;
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    // Find assignments where:
    //   1. due_date is within the next 48 hours (not yet overdue)
    //   2. reminder has NOT been sent yet
    const { data: dueAssignments, error } = await supabase
      .from("assignments")
      .select("id, paper_id, reviewer_id, due_date, conference_id, users!reviewer_id(id, name, email), research_papers!paper_id(id, title, conference_name)")
      .gt("due_date", now.toISOString())
      .lte("due_date", windowEnd.toISOString())
      .eq("reminder_sent", false);

    if (error) {
      console.error("[reminderService] Error querying due assignments:", error.message);
      return;
    }

    if (!dueAssignments || dueAssignments.length === 0) {
      return;
    }

    // Filter out assignments where the reviewer has already submitted a review
    const paperIds = dueAssignments.map((a) => a.paper_id);
    const reviewerIds = dueAssignments.map((a) => a.reviewer_id);

    const { data: submittedReviews } = await supabase
      .from("reviews")
      .select("paper_id, reviewer_id")
      .in("paper_id", paperIds)
      .in("reviewer_id", reviewerIds);

    const reviewedSet = new Set(
      (submittedReviews || []).map((r) => `${r.paper_id}:${r.reviewer_id}`)
    );

    const baseUrl = process.env.BASE_URL || "";

    for (const assignment of dueAssignments) {
      const key = `${assignment.paper_id}:${assignment.reviewer_id}`;
      if (reviewedSet.has(key)) {
        // Reviewer already reviewed — mark reminder_sent so we don't query again
        await supabase
          .from("assignments")
          .update({ reminder_sent: true })
          .eq("id", assignment.id);
        continue;
      }

      const reviewer = assignment.users;
      const paper = assignment.research_papers;

      if (!reviewer?.email || !paper) continue;

      const paperLink = `${baseUrl}/reviewer/papers?paperId=${assignment.paper_id}`;

      const html = buildReminderHtml({
        reviewerName: reviewer.name,
        paperTitle: paper.title,
        conferenceName: paper.conference_name,
        dueDate: assignment.due_date,
        paperLink,
      });

      const { sent } = await sendMail({
        type: "paper",
        to: reviewer.email,
        subject: `Reminder: Review due in less than 48 hours — ${paper.title}`,
        html,
      });

      if (sent) {
        await supabase
          .from("assignments")
          .update({ reminder_sent: true })
          .eq("id", assignment.id);

        console.log(`[reminderService] Reminder sent to ${reviewer.email} for paper "${paper.title}"`);
      } else {
        console.warn(`[reminderService] Failed to send reminder to ${reviewer.email} for paper "${paper.title}"`);
      }
    }
  } catch (err) {
    console.error("[reminderService] Unexpected error:", err.message);
  }
};

export const startReminderService = () => {
  console.log("[reminderService] Starting — checking for due reviews every hour.");
  runReminderCheck();
  setInterval(runReminderCheck, CHECK_INTERVAL_MS);
};
