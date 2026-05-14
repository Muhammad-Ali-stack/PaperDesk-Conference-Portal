import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";
import { titleCase } from "title-case";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import PQueue from "p-queue";

const proceedingsQueue = new PQueue({ concurrency: 2 });

/**
 * Helper function to send email notifications to authors about paper status changes.
 */
const sendPaperStatusEmail = async ({ paperId, subject, headingText, bodyText, statusLabel }) => {
  try {
    const { data: paper } = await supabase
      .from("research_papers")
      .select("title, conference_name, paper_authors(authors(email, first_name))")
      .eq("id", paperId)
      .maybeSingle();

    if (!paper) return;

    const paperTitle = paper.title || "Your Paper";
    const conferenceName = paper.conference_name || "";
    const authors = (paper.paper_authors || []).map((pa) => pa.authors).filter(Boolean);
    const emails = authors.map((a) => a.email).filter(Boolean);

    if (emails.length === 0) return;

    const html = `
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
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">ConForum</h1>
              <p style="margin:6px 0 0;color:#d1e8eb;font-size:13px;">Conference Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">${headingText}</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${bodyText}</p>
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B707A;text-transform:uppercase;letter-spacing:0.5px;">Paper Details</p>
                <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Title:</strong> ${paperTitle}</p>
                <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Conference:</strong> ${conferenceName}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Status:</strong> ${statusLabel}</p>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">If you have any questions, please contact the conference organizers.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ConForum &mdash; Conference Management System</p>
            </td>
          </tr>
        </table>
      </td>
    <tr>
  ｜DSML｜
</body>
</html>
    `;

    await Promise.all(
      emails.map((email) =>
        sendMail({ type: "paper", to: email, subject, html })
      )
    );
  } catch (_) {}
};

/**
 * Saves or updates the plagiarism score for a paper.
 */
export const savePlagiarismScoreController = async (req, res) => {
  try {
    const { paperId, plagiarismScore } = req.body;

    if (!paperId) {
      return res.status(400).json({ success: false, message: "Paper ID is required." });
    }

    if (plagiarismScore === undefined || plagiarismScore === null || plagiarismScore === "") {
      return res.status(400).json({ success: false, message: "Plagiarism score is required." });
    }

    const score = Number(plagiarismScore);

    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ success: false, message: "Plagiarism score must be a number between 0 and 100." });
    }

    const { data: updatedPaper, error } = await supabase
      .from("research_papers")
      .update({ organizer_plagiarism_score: score })
      .eq("id", paperId)
      .select("organizer_plagiarism_score")
      .maybeSingle();

    if (error || !updatedPaper) {
      return res.status(404).json({ success: false, message: "Paper not found or update failed." });
    }

    return res.status(200).json({
      success: true,
      message: "Plagiarism score saved successfully.",
      data: { plagiarismScore: updatedPaper.organizer_plagiarism_score },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save plagiarism score." });
  }
};

/**
 * Automatically assigns pending papers to available reviewers for a conference.
 * Fixes N+1 query by using pre-fetched assignments map instead of querying per paper.
 */
export const assignPapersToReviewersController = async (req, res) => {
  try {
    const { conferenceId } = req.body;
    const MAX_PAPERS_PER_REVIEWER = 5;
    const REVIEWERS_PER_PAPER = 3;

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    const { data: papers, error: papersError } = await supabase
      .from("research_papers")
      .select("id, title, keywords, status, organizer_plagiarism_score")
      .eq("conference_id", conferenceId)
      .in("status", ["pending", "resubmitted"]);

    if (papersError || !papers || papers.length === 0) {
      return res.status(404).json({ success: false, message: "No pending or resubmitted papers found for this conference." });
    }

    const { data: reviewerRoles, error: reviewersError } = await supabase
      .from("user_conference_roles")
      .select("user_id, expertise, users!user_id(id, name, email)")
      .eq("conference_id", conferenceId)
      .eq("role", "reviewer");

    if (reviewersError || !reviewerRoles || reviewerRoles.length === 0) {
      return res.status(404).json({ success: false, message: "No reviewers found for this conference." });
    }

    const reviewers = reviewerRoles.map((r) => ({
      userId: r.user_id,
      expertise: r.expertise || [],
      name: r.users?.name,
      email: r.users?.email,
    }));

    const reviewerAssignmentCount = {};
    reviewers.forEach((r) => { reviewerAssignmentCount[r.userId] = 0; });

    // Fetch all existing assignments for this conference once
    const { data: existingAssignments } = await supabase
      .from("assignments")
      .select("paper_id, reviewer_id")
      .eq("conference_id", conferenceId);

    // Build a map: paper_id -> array of reviewer_ids already assigned
    const assignmentsByPaperId = new Map();
    (existingAssignments || []).forEach((a) => {
      if (!assignmentsByPaperId.has(a.paper_id)) {
        assignmentsByPaperId.set(a.paper_id, []);
      }
      assignmentsByPaperId.get(a.paper_id).push(a.reviewer_id);
      if (reviewerAssignmentCount[a.reviewer_id] !== undefined) {
        reviewerAssignmentCount[a.reviewer_id] += 1;
      }
    });

    const findMatchingReviewer = (keywords, assignedReviewers) => {
      for (const reviewer of reviewers) {
        if (
          reviewer.expertise.some((exp) => keywords.includes(exp)) &&
          reviewerAssignmentCount[reviewer.userId] < MAX_PAPERS_PER_REVIEWER &&
          !assignedReviewers.includes(reviewer.userId)
        ) {
          return reviewer;
        }
      }
      return null;
    };

    const assignments = [];
    const warnings = [];
    const skippedNoPlagiarism = [];

    for (const paper of papers) {
      // Papers without a plagiarism score cannot be assigned — skip and report them.
      if (paper.organizer_plagiarism_score === null || paper.organizer_plagiarism_score === undefined) {
        skippedNoPlagiarism.push({ paperId: paper.id, title: paper.title });
        continue;
      }

      const keywords = paper.keywords || [];
      const alreadyAssigned = assignmentsByPaperId.get(paper.id) || [];
      const currentCount = alreadyAssigned.length;

      if (currentCount >= REVIEWERS_PER_PAPER) continue;

      const newAssignments = [];
      const assignedReviewers = [...alreadyAssigned];

      while (assignedReviewers.length < REVIEWERS_PER_PAPER) {
        let assignedReviewer = findMatchingReviewer(keywords, assignedReviewers);

        if (!assignedReviewer) {
          assignedReviewer = reviewers.find(
            (r) =>
              reviewerAssignmentCount[r.userId] < MAX_PAPERS_PER_REVIEWER &&
              !assignedReviewers.includes(r.userId)
          );
        }

        if (assignedReviewer) {
          const { error: assignError } = await supabase
            .from("assignments")
            .insert({
              paper_id: paper.id,
              reviewer_id: assignedReviewer.userId,
              conference_id: conferenceId,
            });

          if (!assignError) {
            newAssignments.push({ paperId: paper.id, reviewerId: assignedReviewer.userId });
            assignedReviewers.push(assignedReviewer.userId);
            reviewerAssignmentCount[assignedReviewer.userId] += 1;
            // Update the in-memory map so future papers also see this assignment
            if (!assignmentsByPaperId.has(paper.id)) {
              assignmentsByPaperId.set(paper.id, []);
            }
            assignmentsByPaperId.get(paper.id).push(assignedReviewer.userId);
          }
        } else {
          break;
        }
      }

      assignments.push(...newAssignments);

      if (newAssignments.length > 0 || alreadyAssigned.length > 0) {
        await supabase
          .from("research_papers")
          .update({ status: "assigned" })
          .eq("id", paper.id);

        if (currentCount === 0) {
          sendPaperStatusEmail({
            paperId: paper.id,
            subject: `Your Paper Has Been Assigned for Review: ${paper.title}`,
            headingText: "Your Paper Has Been Assigned for Review",
            bodyText: "Reviewers have been assigned to evaluate your submission. You will be notified once the review process is complete.",
            statusLabel: "Assigned for Review",
          });
        }

        if (assignedReviewers.length < REVIEWERS_PER_PAPER) {
          warnings.push({
            paperId: paper.id,
            title: paper.title,
            assignedReviewers: assignedReviewers.length,
            message: `Only ${assignedReviewers.length} reviewer(s) assigned to "${paper.title}".`,
          });
        }
      }
    }

    if (assignments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No papers could be assigned. Check that reviewers are available and not already at their maximum paper limit.",
        data: {
          warnings: warnings.length > 0 ? warnings : undefined,
          skippedNoPlagiarism: skippedNoPlagiarism.length > 0 ? skippedNoPlagiarism : undefined,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `${assignments.length} paper-reviewer assignment(s) created.`,
      data: {
        warnings: warnings.length > 0 ? warnings : undefined,
        skippedNoPlagiarism: skippedNoPlagiarism.length > 0 ? skippedNoPlagiarism : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while assigning papers." });
  }
};

/**
 * Returns all reviewer assignments for a conference, grouped by paper.
 */
export const getAssignmentsByConferenceController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select("*, research_papers!paper_id(id, title, keywords, conference_name), users!reviewer_id(id, name, email)")
      .eq("conference_id", conferenceId);

    if (error || !assignments || assignments.length === 0) {
      return res.status(404).json({ success: false, message: "No assignments found for this conference." });
    }

    const papersWithAssignments = {};
    assignments.forEach((a) => {
      const pid = a.paper_id;
      if (!papersWithAssignments[pid]) {
        papersWithAssignments[pid] = { _id: pid, assignedReviewers: [], count: 0 };
      }
      papersWithAssignments[pid].assignedReviewers.push(a.reviewer_id);
      papersWithAssignments[pid].count += 1;
    });

    return res.status(200).json({
      success: true,
      message: "Assignments fetched successfully.",
      data: {
        assignments,
        papersWithAssignments: Object.values(papersWithAssignments),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while fetching assignments." });
  }
};

/**
 * Returns a consolidated review management table for a conference.
 */
export const getReviewManagementDataController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

   const { data: papers, error: papersError } = await supabase
  .from("research_papers")
  .select("id, title, status, final_decision, compliance_report, conference_name, organizer_plagiarism_score, organizer_comments_for_authors, paper_authors(authors(first_name, email))")
  .eq("conference_id", conferenceId);

    if (papersError) {
      return res.status(500).json({ success: false, message: "Error fetching review management data." });
    }

    const paperIds = (papers || []).map((p) => p.id);

    const { data: allReviews } = await supabase
      .from("reviews")
      .select("id, paper_id, reviewer_id, overall_recommendation, technical_confidence, comments_for_authors, comments_for_organizers")
      .in("paper_id", paperIds);

    const { data: allAssignments } = await supabase
      .from("assignments")
      .select("paper_id, reviewer_id, users!reviewer_id(name)")
      .eq("conference_id", conferenceId);

    const tableData = (papers || []).map((paper) => {
      const paperAssignments = (allAssignments || []).filter(
        (a) => a.paper_id === paper.id
      );

      const reviewers = paperAssignments.map((assignment) => {
        const review = (allReviews || []).find(
          (r) => r.paper_id === paper.id && r.reviewer_id === assignment.reviewer_id
        );
        return {
          name: assignment.users?.name || "Unknown Reviewer",
          reviewerId: assignment.reviewer_id,
          status: review ? "reviewed" : "pending",
          recommendation: review?.overall_recommendation || "-",
          technicalConfidence: review?.technical_confidence !== undefined
            ? Number(Number(review.technical_confidence).toFixed(4))
            : "0.00",
          commentsForOrganizers: review?.comments_for_organizers || null,
          commentsForAuthors: review?.comments_for_authors || null,
        };
      });

      const totalTechConfidence = reviewers.reduce(
        (sum, r) => sum + (typeof r.technicalConfidence === "number" ? r.technicalConfidence : 0),
        0
      );
      const avgTechConfidence =
        reviewers.length > 0 ? Number(totalTechConfidence / reviewers.length).toFixed(2) : "N/A";

      const authors = (paper.paper_authors || []).map((pa) => ({
        name: pa.authors?.first_name,
        email: pa.authors?.email,
      }));

      return {
  paperId: paper.id,
  title: paper.title,
  reviewers,
  overallstatus: reviewers.every((r) => r.status === "reviewed") && reviewers.length > 0 ? "Consensus" : "In Progress",
  status: paper.status,
  decision: paper.final_decision,
  avgTechConfidence,
  complianceScore: paper.compliance_report?.percentage ?? null,
  plagiarismScore: paper.organizer_plagiarism_score ?? null,
  organizerCommentsForAuthors: paper.organizer_comments_for_authors ?? null,   // <-- ADD THIS LINE
  authors,
  conferenceName: paper.conference_name,
};
    });

    return res.status(200).json({
      success: true,
      message: "Review management data fetched successfully.",
      data: tableData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching review management data." });
  }
};

/**
 * Returns all reviews submitted for a specific paper, with reviewer details.
 */
export const getReviewsByPaperIdController = async (req, res) => {
  try {
    const { paperId } = req.params;

    if (!paperId) {
      return res.status(400).json({ success: false, message: "Paper ID is required." });
    }

    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("*, users!reviewer_id(id, name, email)")
      .eq("paper_id", paperId);

    if (error || !reviews || reviews.length === 0) {
      return res.status(404).json({ success: false, message: "No reviews found for this paper." });
    }

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully.",
      data: reviews,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while fetching reviews." });
  }
};

/**
 * Returns all reviews for a given set of paper IDs.
 */
export const getReviewsOfAllPapersController = async (req, res) => {
  try {
    const { paperIds } = req.body;

    if (!paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ success: false, message: "A valid array of paper IDs is required." });
    }

    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("*, users!reviewer_id(id, name, email)")
      .in("paper_id", paperIds);

    if (error || !reviews || reviews.length === 0) {
      return res.status(404).json({ success: false, message: "No reviews found for the given papers." });
    }

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully.",
      data: reviews,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while fetching reviews." });
  }
};

/**
 * Sets the final editorial decision for a paper.
 *
 * This controller now accepts two optional fields in addition to paperId and decision:
 * - commentsForAuthors: free text feedback from the organizer (saved to organizer_comments_for_authors)
 * - plagiarismScore: numeric value (0-100) that is stored in organizer_plagiarism_score.
 *
 * Both fields are optional. If not provided, the existing values remain unchanged.
 *
 * When the organizer uses the "Review Myself" flow, the plagiarismScore should be sent
 * together with the decision in the same request. This ensures the score is stored
 * atomically with the decision.
 */
export const updateFinalDecisionController = async (req, res) => {
  try {
    const { paperId, decision, commentsForAuthors, plagiarismScore } = req.body;

    if (!paperId || !decision) {
      return res.status(400).json({ success: false, message: "Paper ID and decision are required." });
    }

    const validDecisions = ["Accepted", "Rejected", "Modification Required"];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ success: false, message: "Invalid decision value." });
    }

    // Build the update payload
    const updateFields = { final_decision: decision };

    // When modification is required, reset status so the author can resubmit
    if (decision === "Modification Required") {
      updateFields.status = "pending";
    }

    // Persist organizer comments to the DB if provided (optional)
    if (commentsForAuthors && commentsForAuthors.trim() !== "") {
      updateFields.organizer_comments_for_authors = commentsForAuthors.trim();
    }

    // Persist the plagiarism score if provided and valid
    if (plagiarismScore !== undefined && plagiarismScore !== null) {
      const score = parseFloat(plagiarismScore);
      if (!isNaN(score) && score >= 0 && score <= 100) {
        updateFields.organizer_plagiarism_score = score;
      } else {
        return res.status(400).json({ success: false, message: "Invalid plagiarism score. Must be between 0 and 100." });
      }
    }

    const { data: updatedPaper, error } = await supabase
      .from("research_papers")
      .update(updateFields)
      .eq("id", paperId)
      .select()
      .maybeSingle();

    if (error || !updatedPaper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    // Email configuration for authors
    const emailConfig = {
      Accepted: {
        subject: "Congratulations! Your Paper Has Been Accepted",
        headingText: "Your Paper Has Been Accepted",
        bodyText: "We are pleased to inform you that your submission has been accepted for the conference. Congratulations on this achievement!",
        statusLabel: "Accepted",
      },
      Rejected: {
        subject: "Update on Your Paper Submission",
        headingText: "Decision on Your Paper",
        bodyText: "After careful review, we regret to inform you that your submission has not been accepted for the conference. We appreciate your effort and encourage you to consider future submissions.",
        statusLabel: "Rejected",
      },
      "Modification Required": {
        subject: "Modification Required for Your Paper",
        headingText: "Modification Required",
        bodyText: "The reviewers have requested modifications to your paper before it can be considered further. Please review the feedback and resubmit.",
        statusLabel: "Modification Required",
      },
    };

    const cfg = emailConfig[decision];
    if (cfg) {
      // Append organizer comments to the email body if present
      const emailBodyText =
        commentsForAuthors && commentsForAuthors.trim() !== ""
          ? `${cfg.bodyText}\n\nOrganizer feedback: ${commentsForAuthors.trim()}`
          : cfg.bodyText;

      sendPaperStatusEmail({
        paperId,
        ...cfg,
        bodyText: emailBodyText,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Decision updated successfully.",
      data: { paper: updatedPaper },
    });
  } catch (error) {
    console.error("updateFinalDecisionController error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * Manually assigns one or more reviewers to a paper.
 */
export const manuallyAssignPaperController = async (req, res) => {
  try {
    const { paperId, conferenceId, plagiarismScore } = req.body;

    let reviewerIds = req.body.reviewerIds;
    if (!reviewerIds && req.body.reviewerId) {
      reviewerIds = [req.body.reviewerId];
    }
    reviewerIds = (reviewerIds || []).filter(Boolean);

    if (!paperId || !conferenceId) {
      return res.status(400).json({ success: false, message: "paperId and conferenceId are required." });
    }
    if (reviewerIds.length === 0) {
      return res.status(400).json({ success: false, message: "At least one reviewerId is required." });
    }
    if (reviewerIds.length > 3) {
      return res.status(400).json({ success: false, message: "Cannot assign more than 3 reviewers at once." });
    }

    const uniqueReviewerIds = [...new Set(reviewerIds)];

    const { data: paper } = await supabase
      .from("research_papers")
      .select("id, status, organizer_plagiarism_score")
      .eq("id", paperId)
      .maybeSingle();

    if (!paper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    let resolvedPlagiarismScore = paper.organizer_plagiarism_score;

    if (resolvedPlagiarismScore === null || resolvedPlagiarismScore === undefined) {
      if (plagiarismScore === undefined || plagiarismScore === null || plagiarismScore === "") {
        return res.status(400).json({
          success: false,
          message: "Plagiarism score is required before assigning reviewers. Please enter a plagiarism score first.",
        });
      }

      const parsed = parseFloat(plagiarismScore);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        return res.status(400).json({
          success: false,
          message: "Plagiarism score must be a number between 0 and 100.",
        });
      }

      const { data: updatedPaper, error: updateError } = await supabase
        .from("research_papers")
        .update({ organizer_plagiarism_score: parsed })
        .eq("id", paperId)
        .select("organizer_plagiarism_score")
        .maybeSingle();

      if (updateError || !updatedPaper) {
        return res.status(500).json({
          success: false,
          message: "Failed to save plagiarism score. Please try again.",
        });
      }

      resolvedPlagiarismScore = updatedPaper.organizer_plagiarism_score;
    }

    const { data: existingAssignments } = await supabase
      .from("assignments")
      .select("reviewer_id")
      .eq("paper_id", paperId);

    const alreadyAssignedIds = (existingAssignments || []).map((a) => a.reviewer_id);
    const currentCount = alreadyAssignedIds.length;
    const slotsAvailable = 3 - currentCount;

    if (slotsAvailable <= 0) {
      return res.status(400).json({ success: false, message: "This paper already has 3 reviewers assigned." });
    }

    const results = [];
    let newlyAssignedCount = 0;

    for (const reviewerId of uniqueReviewerIds) {
      if (newlyAssignedCount >= slotsAvailable) {
        results.push({ reviewerId, status: "skipped", reason: "Paper already at maximum 3 reviewers." });
        continue;
      }

      if (alreadyAssignedIds.includes(reviewerId)) {
        results.push({ reviewerId, status: "already_assigned", reason: "Reviewer was already assigned (retained)." });
        continue;
      }

      const { error: insertError } = await supabase
        .from("assignments")
        .insert({ paper_id: paperId, reviewer_id: reviewerId, conference_id: conferenceId });

      if (insertError) {
        results.push({ reviewerId, status: "failed", reason: insertError.message });
      } else {
        alreadyAssignedIds.push(reviewerId);
        newlyAssignedCount += 1;
        results.push({ reviewerId, status: "assigned" });
      }
    }

    const anyNewlyAssigned = results.some((r) => r.status === "assigned");

    if (anyNewlyAssigned) {
      await supabase
        .from("research_papers")
        .update({ status: "assigned" })
        .eq("id", paperId);

      sendPaperStatusEmail({
        paperId,
        subject: "Your Paper Has Been Assigned for Review",
        headingText: "Your Paper Has Been Assigned for Review",
        bodyText: "Reviewer(s) have been assigned to evaluate your submission. You will be notified once the review process is complete.",
        statusLabel: "Assigned for Review",
      });
    }

    const allAlreadyAssigned = results.every((r) => r.status === "already_assigned");

    return res.status(200).json({
      success: true,
      message: allAlreadyAssigned
        ? "All selected reviewers were already assigned from a previous round."
        : `${newlyAssignedCount} reviewer(s) assigned successfully.`,
      data: {
        alreadyAssigned: allAlreadyAssigned,
        newlyAssigned: newlyAssignedCount,
        totalAssigned: alreadyAssignedIds.length,
        plagiarismScore: resolvedPlagiarismScore,
        results,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to assign reviewers to paper." });
  }
};

/**
 * Sets or updates the technical review weightage for a conference.
 */
export const setTechnicalWeightageController = async (req, res) => {
  try {
    const { conferenceId, originality, technicalQuality, significance, clarity, relevance } = req.body;

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    if (originality === undefined || technicalQuality === undefined || significance === undefined || clarity === undefined || relevance === undefined) {
      return res.status(400).json({ success: false, message: "All weightage fields are required." });
    }

    const total = originality + technicalQuality + significance + clarity + relevance;
    if (total !== 100) {
      return res.status(400).json({ success: false, message: "Total weightage must be exactly 100%." });
    }

    const { data: updatedWeightage, error } = await supabase
      .from("technical_weightage")
      .upsert(
        { conference_id: conferenceId, originality, technical_quality: technicalQuality, significance, clarity, relevance },
        { onConflict: "conference_id" }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: "Failed to update technical weightage." });
    }

    return res.status(200).json({
      success: true,
      message: "Technical weightage updated successfully.",
      data: { weightage: updatedWeightage },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update technical weightage." });
  }
};

/**
 * Returns the technical weightage settings for a conference.
 */
export const getTechnicalWeightageController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    const { data: weightage } = await supabase
      .from("technical_weightage")
      .select("*")
      .eq("conference_id", conferenceId)
      .maybeSingle();

    const result = weightage || {
      originality: 30,
      technical_quality: 25,
      significance: 20,
      clarity: 15,
      relevance: 10,
    };

    return res.status(200).json({
      success: true,
      message: "Technical weightage fetched successfully.",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch technical weightage." });
  }
};

/**
 * Returns reviewer assignment counts and reviewer details for a set of papers.
 */
export const getAssignmentsByPaperController = async (req, res) => {
  try {
    const { paperIds } = req.body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ success: false, message: "An array of paper IDs is required." });
    }

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select("paper_id, reviewer_id, users!reviewer_id(id, name, email)")
      .in("paper_id", paperIds);

    if (error) {
      return res.status(500).json({ success: false, message: "An error occurred while fetching assigned reviewers." });
    }

    const assignmentsByPaper = {};
    (assignments || []).forEach(({ paper_id, reviewer_id, users }) => {
      if (!assignmentsByPaper[paper_id]) {
        assignmentsByPaper[paper_id] = { assignedCount: 0, reviewers: [] };
      }
      assignmentsByPaper[paper_id].assignedCount += 1;
      assignmentsByPaper[paper_id].reviewers.push({
        reviewerId: reviewer_id,
        name: users?.name || "Unknown",
        email: users?.email || "",
      });
    });

    return res.status(200).json({
      success: true,
      message: "Assignments fetched successfully.",
      data: assignmentsByPaper,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while fetching assigned reviewers." });
  }
};

/**
 * Returns all accepted papers for a conference.
 */
export const fetchAcceptedPapersController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    const { data: papers, error } = await supabase
      .from("research_papers")
      .select("*, paper_authors(authors(first_name, last_name, email, affiliation))")
      .eq("conference_id", conferenceId)
      .eq("final_decision", "Accepted");

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching accepted papers." });
    }

    return res.status(200).json({
      success: true,
      message: "Accepted papers fetched successfully.",
      data: { papers: papers || [] },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching accepted papers." });
  }
};

/**
 * Returns all conferences where the user has the 'organizer' role.
 */
export const getOrganizerConferencesController = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }

    const { data, error } = await supabase
      .from("user_conference_roles")
      .select("conference_id, conferences!conference_id(id, conference_name, acronym)")
      .eq("user_id", userId)
      .eq("role", "organizer");

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching conferences.", data: { error: error.message } });
    }

    const conferences = (data || []).map((row) => row.conferences).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Organizer conferences fetched successfully.",
      data: { conferences },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching conferences.", data: { error: error.message } });
  }
};

/**
 * Generates a proceedings PDF for a conference containing all accepted papers.
 */
export const proceedingsPdfGenerationController = async (req, res) => {
  const { conferenceId } = req.params;

  return proceedingsQueue.add(async () => {
    try {
      const { data: conference } = await supabase
        .from("conferences")
        .select("*")
        .eq("id", conferenceId)
        .maybeSingle();

      if (!conference) {
        return res.status(404).json({ success: false, message: "Conference not found." });
      }

      const { data: papers } = await supabase
        .from("research_papers")
        .select("*, paper_authors(authors(first_name, last_name, email, affiliation))")
        .eq("conference_id", conferenceId)
        .eq("final_decision", "Accepted");

      const pdfDoc = await PDFDocument.create();
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const TEAL = rgb(0.29, 0.44, 0.48);
      const WHITE = rgb(1, 1, 1);
      const DARK = rgb(0.1, 0.1, 0.1);
      const GRAY = rgb(0.45, 0.45, 0.45);
      const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);

      const PAGE_W = 595;
      const PAGE_H = 842;
      const MARGIN = 50;

      const coverPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      coverPage.drawRectangle({ x: 0, y: PAGE_H - 160, width: PAGE_W, height: 160, color: TEAL });

      coverPage.drawText("ConForum", { x: MARGIN, y: PAGE_H - 55, size: 28, font: helveticaBold, color: WHITE });
      coverPage.drawText("Conference Management System", { x: MARGIN, y: PAGE_H - 80, size: 12, font: helvetica, color: rgb(0.82, 0.92, 0.93) });
      coverPage.drawText("Proceedings", { x: MARGIN, y: PAGE_H - 120, size: 22, font: helveticaBold, color: WHITE });

      const confName = titleCase(conference.conference_name || "Conference");
      coverPage.drawText(confName, { x: MARGIN, y: PAGE_H - 220, size: 20, font: helveticaBold, color: DARK, maxWidth: PAGE_W - MARGIN * 2 });

      if (conference.acronym) {
        coverPage.drawText(conference.acronym, { x: MARGIN, y: PAGE_H - 248, size: 14, font: helvetica, color: TEAL });
      }

      const detailLines = [
        conference.venue ? `Venue: ${conference.venue}` : null,
        conference.city && conference.country ? `Location: ${conference.city}, ${conference.country}` : null,
        conference.start_date ? `Date: ${conference.start_date}${conference.end_date ? ` – ${conference.end_date}` : ""}` : null,
      ].filter(Boolean);

      let dy = PAGE_H - 290;
      for (const line of detailLines) {
        coverPage.drawText(line, { x: MARGIN, y: dy, size: 11, font: helvetica, color: GRAY });
        dy -= 20;
      }

      if (req.file) {
        try {
          const introImageBytes = req.file.buffer;
          let embeddedImage;
          const mime = req.file.mimetype;
          if (mime === "image/png") {
            embeddedImage = await pdfDoc.embedPng(introImageBytes);
          } else if (mime === "image/jpeg" || mime === "image/jpg") {
            embeddedImage = await pdfDoc.embedJpg(introImageBytes);
          }
          if (embeddedImage) {
            const imgDims = embeddedImage.scaleToFit(PAGE_W - MARGIN * 2, 200);
            coverPage.drawImage(embeddedImage, { x: MARGIN, y: dy - imgDims.height - 20, width: imgDims.width, height: imgDims.height });
          }
        } catch (_) {}
      }

      coverPage.drawText(`Total Accepted Papers: ${(papers || []).length}`, { x: MARGIN, y: 100, size: 12, font: helveticaBold, color: TEAL });
      coverPage.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: MARGIN, y: 70, size: 10, font: helvetica, color: GRAY });

      for (const paper of papers || []) {
        const paperPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
        paperPage.drawRectangle({ x: 0, y: PAGE_H - 60, width: PAGE_W, height: 60, color: LIGHT_GRAY });
        paperPage.drawText("ConForum Proceedings", { x: MARGIN, y: PAGE_H - 38, size: 10, font: helvetica, color: GRAY });

        const titleText = paper.title || "Untitled Paper";
        paperPage.drawText(titleText, { x: MARGIN, y: PAGE_H - 110, size: 14, font: helveticaBold, color: DARK, maxWidth: PAGE_W - MARGIN * 2, lineHeight: 20 });

        const authorsText = (paper.paper_authors || [])
          .map((pa) => `${pa.authors?.first_name || ""} ${pa.authors?.last_name || ""}`.trim())
          .filter(Boolean)
          .join(", ");

        paperPage.drawText(authorsText || "Author(s) not listed", { x: MARGIN, y: PAGE_H - 160, size: 10, font: helvetica, color: TEAL, maxWidth: PAGE_W - MARGIN * 2 });

        const affiliations = (paper.paper_authors || []).map((pa) => pa.authors?.affiliation).filter(Boolean).join("; ");
        if (affiliations) {
          paperPage.drawText(affiliations, { x: MARGIN, y: PAGE_H - 180, size: 9, font: helvetica, color: GRAY, maxWidth: PAGE_W - MARGIN * 2 });
        }

        paperPage.drawLine({ start: { x: MARGIN, y: PAGE_H - 195 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 195 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        paperPage.drawText("Abstract", { x: MARGIN, y: PAGE_H - 220, size: 11, font: helveticaBold, color: TEAL });

        const abstract = paper.abstract || "No abstract provided.";
        const abstractWords = abstract.split(" ");
        let line = "";
        let yPos = PAGE_H - 238;
        for (const word of abstractWords) {
          const testLine = line ? `${line} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
          if (testWidth > PAGE_W - MARGIN * 2) {
            paperPage.drawText(line, { x: MARGIN, y: yPos, size: 10, font: helvetica, color: DARK });
            yPos -= 15;
            line = word;
            if (yPos < 80) break;
          } else {
            line = testLine;
          }
        }
        if (line && yPos >= 80) {
          paperPage.drawText(line, { x: MARGIN, y: yPos, size: 10, font: helvetica, color: DARK });
          yPos -= 15;
        }

        if (paper.keywords && paper.keywords.length > 0) {
          paperPage.drawText("Keywords:", { x: MARGIN, y: yPos - 10, size: 10, font: helveticaBold, color: DARK });
          paperPage.drawText(paper.keywords.join(", "), { x: MARGIN + 65, y: yPos - 10, size: 10, font: helvetica, color: GRAY, maxWidth: PAGE_W - MARGIN * 2 - 65 });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = `proceedings_${conferenceId}_${Date.now()}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("paper-submissions")
        .upload(fileName, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        return res.status(500).json({ success: false, message: "Failed to upload proceedings PDF." });
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/paper-submissions/${uploadData.path}`;

      await supabase.from("conferences").update({ proceedings_pdf_url: publicUrl }).eq("id", conferenceId);

      return res.status(200).json({
        success: true,
        message: "Proceedings PDF generated and uploaded successfully.",
        data: { url: publicUrl },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Failed to generate proceedings PDF.", data: { error: error.message } });
    }
  });
};