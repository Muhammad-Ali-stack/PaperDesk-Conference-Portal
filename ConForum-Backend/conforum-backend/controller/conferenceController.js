import crypto from "crypto";
import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";

/**
 * Sends an organizer invitation email and persists the invitation record.
 * Only admins may call this endpoint.
 * Email delivery failures are logged but do NOT prevent the invitation
 * record from being saved — the admin can share the link manually if needed.
 *
 * @route POST /api/v1/conference/send-invite
 * @param {string} req.body.organizerEmail - Email address to invite.
 * @param {string} [req.body.message]      - Optional personal message from the admin.
 * @returns {200} Invitation created — `{ emailSent: boolean }`.
 * @returns {400} Organizer email is missing.
 * @returns {500} Server error.
 */
export const sendOrganizerInviteController = async (req, res) => {
  try {
    const { organizerEmail, message } = req.body;

    if (!organizerEmail) {
      return res.status(400).json({ message: "Organizer email is required." });
    }

    const inviteToken = crypto.randomUUID();

    await supabase.from("invitations").insert({
      email: organizerEmail,
      conference_id: null,
      role: "organizer",
      status: "pending",
      token: inviteToken,
    });

    const inviteLink = `${process.env.BASE_URL}/register?role=organizer&token=${inviteToken}`;

    const emailHtml = `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Organizer Invitation</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#4B707A; padding: 32px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800; letter-spacing:1px;">ConForum</h1>
              <p style="margin:6px 0 0; color:#d1e8eb; font-size:13px;">Conference Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 32px;">
              <h2 style="margin:0 0 8px; color:#1a1a1a; font-size:22px; font-weight:700;">
                You have been invited as an Organizer
              </h2>
              <p style="margin:0 0 24px; color:#6b7280; font-size:14px;">
                You have been selected to manage a conference on ConForum.
              </p>
              ${message ? `
              <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin-bottom:28px;">
                <p style="margin:0 0 6px; font-size:11px; font-weight:700; color:#4B707A; text-transform:uppercase; letter-spacing:0.5px;">Message from Admin</p>
                <p style="margin:0; font-size:14px; color:#374151; line-height:1.7; white-space:pre-line;">${message}</p>
              </div>
              ` : ""}
              <p style="margin:0 0 24px; font-size:14px; color:#374151; line-height:1.7;">
                As an organizer, you will be responsible for creating and managing conference submissions, assigning reviewers, and making final decisions on papers.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:#4B707A; border-radius:8px;">
                    <a href="${inviteLink}" style="display:inline-block; padding:14px 32px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.6;">
                If you did not expect this invitation, you can safely ignore this email.<br/>
                Alternatively, copy and paste this link:<br/>
                <span style="color:#4B707A; word-break:break-all;">${inviteLink}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 40px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ConForum &mdash; Conference Management System<br/>
                This email was sent to <strong>${organizerEmail}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { sent } = await sendMail({
      type: "admin",
      to: organizerEmail,
      subject: `Organizer Invitation — ConForum`,
      html: emailHtml,
    });

    return res.status(200).json({
      message: "Organizer invitation created successfully.",
      emailSent: sent,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error sending organizer invitation.",
      error: error.message,
    });
  }
};

/**
 * Creates a new conference and assigns the creating user as its organizer.
 *
 * Steps performed:
 * 1. Validates required fields and checks for duplicate name/acronym.
 * 2. Inserts the conference row with all provided metadata.
 * 3. Upserts an organizer role record for the user on the new conference.
 * 4. Removes the placeholder organizer role record (conference_id = null)
 *    that was created when the user accepted their invitation, as they now
 *    have a concrete conference assigned.
 *
 * @route POST /api/v1/conference/create-conference
 * @param {string}   req.body.userId
 * @param {string}   req.body.conferenceName
 * @param {string}   req.body.acronym
 * @param {string}   req.body.mode              - Conference review mode ("single-blind" | "double-blind" | "open").
 * @param {string}   req.body.startDate
 * @param {string}   req.body.endDate
 * @param {string[]} req.body.expertise         - Required expertise areas for reviewers.
 * @param {number}   [req.body.max_resubmissions] - Maximum resubmissions per paper (null = unlimited).
 * @param {string}   [req.body.webPage]
 * @param {string}   [req.body.venue]
 * @param {string}   [req.body.city]
 * @param {string}   [req.body.country]
 * @param {string}   [req.body.abstractDeadline]
 * @param {string}   [req.body.submissionDeadline]
 * @param {string}   [req.body.primaryArea]
 * @param {string}   [req.body.secondaryArea]
 * @param {string[]} [req.body.topics]
 * @returns {201} Conference created — `{ conference }`.
 * @returns {400} Validation error or duplicate name/acronym.
 * @returns {404} Organizer user not found.
 * @returns {500} Server error.
 */
export const createConferenceController = async (req, res) => {
  try {
    const {
      userId,
      conferenceName,
      acronym,
      webPage,
      venue,
      city,
      country,
      startDate,
      endDate,
      abstractDeadline,
      submissionDeadline,
      primaryArea,
      secondaryArea,
      topics,
      expertise,
      mode,
      max_resubmissions,
    } = req.body;

    if (!Array.isArray(expertise)) {
      return res.status(400).json({ message: "Expertise must be an array." });
    }

    if (!conferenceName || !mode || !acronym || !startDate || !endDate || !expertise.length) {
      return res.status(400).json({
        message: "Conference name, acronym, start date, expertise, mode, and end date are required.",
      });
    }

    const [{ data: existingByName }, { data: existingByAcronym }] = await Promise.all([
      supabase.from("conferences").select("id").eq("conference_name", conferenceName).maybeSingle(),
      supabase.from("conferences").select("id").eq("acronym", acronym).maybeSingle(),
    ]);

    if (existingByName || existingByAcronym) {
      return res.status(400).json({
        message: "A conference with the same name or acronym already exists.",
      });
    }

    const startDateParsed = new Date(startDate);
    const endDateParsed = new Date(endDate);

    if (isNaN(startDateParsed) || isNaN(endDateParsed)) {
      return res.status(400).json({ message: "Invalid date format for startDate or endDate." });
    }

    const { data: organizerUser } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!organizerUser) {
      return res.status(404).json({ message: "Organizer user not found." });
    }

    const submissionLink = `${process.env.BASE_URL}/conference/${acronym}/submit-paper/${acronym}`;

    const { data: newConference, error: confError } = await supabase
      .from("conferences")
      .insert({
        conference_name: conferenceName,
        acronym,
        web_page: webPage,
        venue,
        city,
        country,
        start_date: startDateParsed.toISOString().split("T")[0],
        end_date: endDateParsed.toISOString().split("T")[0],
        abstract_deadline: abstractDeadline || null,
        submission_deadline: submissionDeadline || null,
        primary_area: primaryArea,
        secondary_area: secondaryArea,
        topics: topics || [],
        expertise,
        status: "pending",
        submission_link: submissionLink,
        organizer_id: userId,
        organizer_name: organizerUser.name,
        organizer_email: organizerUser.email,
        mode,
        max_resubmissions: max_resubmissions !== undefined ? max_resubmissions : null,
      })
      .select()
      .single();

    if (confError) {
      return res.status(500).json({ message: "Error creating conference." });
    }

    await supabase
      .from("user_conference_roles")
      .upsert(
        { user_id: userId, conference_id: newConference.id, role: "organizer" },
        { onConflict: "user_id,conference_id,role" }
      );

    await supabase
      .from("user_conference_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "organizer")
      .is("conference_id", null);

    return res.status(201).json({
      message: "Conference created successfully.",
      conference: newConference,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creating conference." });
  }
};

/**
 * Returns a single conference by ID with its submitted papers and author details.
 *
 * @route GET /api/v1/conference/get-conference/:id
 * @param {string} req.params.id - The conference UUID.
 * @returns {200} Conference object merged with `papers` array.
 * @returns {400} ID parameter is missing.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const getConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Conference ID is required." });
    }

    const { data: conference, error } = await supabase
      .from("conferences")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    const { data: papers } = await supabase
      .from("research_papers")
      .select("*, paper_authors(authors(first_name, email))")
      .eq("conference_id", id);

    return res.status(200).json({ ...conference, papers: papers || [] });
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving conference." });
  }
};

/**
 * Returns all approved conferences in the database.
 *
 * @route GET /api/v1/conference/all-conferences
 * @returns {200} Array of approved conference objects.
 * @returns {404} No approved conferences found.
 * @returns {500} Server error.
 */
export const getAllConferencesController = async (req, res) => {
  try {
    const { data: conferences, error } = await supabase.from("conferences").select("*");

    if (error || !conferences || conferences.length === 0) {
      return res.status(404).json({ message: "No conferences found." });
    }

    return res.status(200).json(conferences);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving conferences." });
  }
};

/**
 * Updates specified metadata fields of an existing conference.
 * Only fields present in the request body are updated.
 *
 * @route PUT /api/v1/conference/update-conference/:id
 * @param {string} req.params.id - Conference UUID.
 * @returns {200} Updated conference object.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const updateConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id;
    const {
      conferenceName,
      acronym,
      webPage,
      venue,
      city,
      country,
      startDate,
      endDate,
      abstractDeadline,
      submissionDeadline,
      primaryArea,
      secondaryArea,
      topics,
    } = req.body;

    const updatedData = {};
    if (conferenceName) updatedData.conference_name = conferenceName;
    if (acronym) updatedData.acronym = acronym;
    if (webPage) updatedData.web_page = webPage;
    if (venue) updatedData.venue = venue;
    if (city) updatedData.city = city;
    if (country) updatedData.country = country;
    if (startDate) updatedData.start_date = startDate;
    if (endDate) updatedData.end_date = endDate;
    if (abstractDeadline) updatedData.abstract_deadline = abstractDeadline;
    if (submissionDeadline) updatedData.submission_deadline = submissionDeadline;
    if (primaryArea) updatedData.primary_area = primaryArea;
    if (secondaryArea) updatedData.secondary_area = secondaryArea;
    if (topics) updatedData.topics = topics;

    const { data: updatedConference, error } = await supabase
      .from("conferences")
      .update(updatedData)
      .eq("id", conferenceId)
      .select()
      .maybeSingle();

    if (error || !updatedConference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    return res.status(200).json({
      message: "Conference updated successfully.",
      conference: updatedConference,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error updating conference." });
  }
};

/**
 * Permanently deletes a conference by ID.
 *
 * @route DELETE /api/v1/conference/delete-conference/:id
 * @param {string} req.params.id - Conference UUID.
 * @returns {200} Deleted conference object.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const deleteConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id;

    const { data: deletedConference, error } = await supabase
      .from("conferences")
      .delete()
      .eq("id", conferenceId)
      .select()
      .maybeSingle();

    if (error || !deletedConference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    return res.status(200).json({
      message: "Conference deleted successfully.",
      conference: deletedConference,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting conference." });
  }
};

/**
 * Returns all conferences with status "pending" (awaiting admin approval).
 *
 * @route GET /api/v1/conference/pending
 * @returns {200} Array of pending conference objects (empty array if none).
 * @returns {500} Server error.
 */
export const getPendingConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase.from("conferences").select("*").eq("status", "pending");
    if (error) return res.status(500).json({ message: "Error retrieving pending conferences." });
    return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving pending conferences." });
  }
};

/**
 * Returns all conferences with status "approved".
 *
 * @route GET /api/v1/conference/all-conferences
 * @returns {200} Array of approved conference objects (empty array if none).
 * @returns {500} Server error.
 */
export const getApprovedConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase.from("conferences").select("*").eq("status", "approved");
    if (error) return res.status(500).json({ message: "Error retrieving approved conferences." });
    return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving approved conferences." });
  }
};

/**
 * Returns all conferences with status "rejected".
 *
 * @route GET /api/v1/conference/rejected-conferences
 * @returns {200} Array of rejected conference objects (empty array if none).
 * @returns {500} Server error.
 */
export const getRejectedConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase.from("conferences").select("*").eq("status", "rejected");
    if (error) return res.status(500).json({ message: "Error retrieving rejected conferences." });
    return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving rejected conferences." });
  }
};

/**
 * Sets a conference's status to "approved".
 * Only admins may call this endpoint.
 *
 * @route PUT /api/v1/conference/approve/:id
 * @param {string} req.params.id - Conference UUID.
 * @returns {200} Updated conference object.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const approveConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updatedConference, error } = await supabase
      .from("conferences")
      .update({ status: "approved" })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error || !updatedConference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    return res.status(200).json({ message: "Conference approved.", conference: updatedConference });
  } catch (error) {
    return res.status(500).json({ message: "Error approving conference." });
  }
};

/**
 * Sets a conference's status to "rejected".
 * Only admins may call this endpoint.
 *
 * @route PUT /api/v1/conference/reject/:id
 * @param {string} req.params.id - Conference UUID.
 * @returns {200} Updated conference object.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const rejectConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updatedConference, error } = await supabase
      .from("conferences")
      .update({ status: "rejected" })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error || !updatedConference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    return res.status(200).json({ message: "Conference rejected.", conference: updatedConference });
  } catch (error) {
    return res.status(500).json({ message: "Error rejecting conference." });
  }
};

/**
 * Returns the full conference name for a given acronym.
 * Used by the public paper-submission page to resolve the conference
 * before the user is authenticated.
 *
 * @route GET /api/v1/conference/:acronym
 * @param {string} req.params.acronym - Conference acronym (e.g. "ICSE25").
 * @returns {200} `{ conferenceName: string }`.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const getConferenceByAcronymController = async (req, res) => {
  try {
    const { acronym } = req.params;
    const { data: conference, error } = await supabase
      .from("conferences")
      .select("conference_name")
      .eq("acronym", acronym)
      .maybeSingle();

    if (error || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    return res.status(200).json({ conferenceName: conference.conference_name });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching conference details." });
  }
};

/**
 * Returns all papers submitted to a conference, enriched with reviewer
 * assignment status and review recommendations for each paper.
 *
 * @route GET /api/v1/conference/:conferenceId/papers
 * @param {string} req.params.conferenceId - Conference UUID.
 * @returns {200} `{ papers: Array }` — each paper includes `reviewers` and `authors`.
 * @returns {404} No papers found.
 * @returns {500} Server error.
 */
export const getPapersByConferenceController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    const { data: papers, error: papersError } = await supabase
      .from("research_papers")
      .select("*, paper_authors(authors(first_name, email))")
      .eq("conference_id", conferenceId);

    if (papersError) return res.status(500).json({ message: "Error retrieving papers." });

    const { data: allReviews } = await supabase
      .from("reviews")
      .select("id, paper_id, reviewer_id, overall_recommendation, technical_confidence");

    const { data: allAssignments } = await supabase
      .from("assignments")
      .select("id, paper_id, reviewer_id, users!reviewer_id(name)")
      .eq("conference_id", conferenceId);

    const enrichedPapers = (papers || []).map((paper) => {
      const paperAssignments = (allAssignments || []).filter(
        (a) => a.paper_id === paper.id
      );

      const reviewers = paperAssignments.map((assignment) => {
        const review = (allReviews || []).find(
          (r) => r.paper_id === paper.id && r.reviewer_id === assignment.reviewer_id
        );
        return {
          name: assignment.users?.name || "Unknown Reviewer",
          status: review ? "reviewed" : "pending",
          recommendation: review?.overall_recommendation || "-",
          technicalConfidence: review?.technical_confidence !== undefined
            ? Number(Number(review.technical_confidence).toFixed(2))
            : "0.00",
        };
      });

      const authors = (paper.paper_authors || []).map((pa) => ({
        firstName: pa.authors?.first_name,
        email: pa.authors?.email,
      }));

      return { ...paper, reviewers, authors, paper_authors: undefined };
    });

    if (enrichedPapers.length === 0) {
      return res.status(404).json({ message: "No papers found for this conference." });
    }

    return res.status(200).json({ papers: enrichedPapers });
  } catch (error) {
    return res.status(500).json({ message: "Error retrieving papers." });
  }
};

/**
 * Returns the resubmission status for a specific paper within a conference.
 * Shows how many resubmissions are allowed, how many have been used, and
 * whether the author can still resubmit.
 *
 * @route GET /api/v1/conference/:conferenceId/papers/:paperId/submission-status
 * @param {string} req.params.conferenceId - Conference UUID.
 * @param {string} req.params.paperId      - Paper UUID.
 * @returns {200} `{ maxResubmissions, currentCount, remaining, unlimited, canResubmit }`.
 * @returns {400} Missing parameters or paper does not belong to the conference.
 * @returns {404} Conference or paper not found.
 * @returns {500} Server error.
 */
export const getSubmissionStatusController = async (req, res) => {
  try {
    const { conferenceId, paperId } = req.params;

    if (!conferenceId || !paperId) {
      return res.status(400).json({ message: "Conference ID and Paper ID are required." });
    }

    const [{ data: conference, error: confError }, { data: paper, error: paperError }] = await Promise.all([
      supabase.from("conferences").select("max_resubmissions").eq("id", conferenceId).maybeSingle(),
      supabase.from("research_papers").select("resubmission_count, conference_id").eq("id", paperId).maybeSingle(),
    ]);

    if (confError || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    if (paperError || !paper) {
      return res.status(404).json({ message: "Paper not found." });
    }

    if (paper.conference_id !== conferenceId) {
      return res.status(400).json({ message: "Paper does not belong to this conference." });
    }

    const maxResubmissions = conference.max_resubmissions ?? null;
    const currentCount = paper.resubmission_count ?? 0;
    const unlimited = maxResubmissions === null;
    const remaining = unlimited ? 1000 : Math.max(0, maxResubmissions - currentCount);

    return res.status(200).json({
      maxResubmissions,
      currentCount,
      remaining,
      unlimited,
      canResubmit: unlimited || remaining > 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error." });
  }
};

/**
 * Sets the maximum number of resubmissions allowed per paper for a conference.
 * Pass `max_resubmissions: null` to remove the limit (unlimited resubmissions).
 * Only the admin or the conference's own organizer may call this endpoint.
 *
 * @route PUT /api/v1/conference/:id/max-resubmissions
 * @param {string}      req.params.id              - Conference UUID.
 * @param {number|null} req.body.max_resubmissions - Positive integer limit, or null for unlimited.
 * @returns {200} Confirmation message.
 * @returns {400} Invalid value for max_resubmissions.
 * @returns {404} Conference not found.
 * @returns {500} Server error.
 */
export const setMaxResubmissionsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { max_resubmissions } = req.body;

    if (max_resubmissions !== null && max_resubmissions !== undefined) {
      const parsed = parseInt(max_resubmissions, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({ message: "max_resubmissions must be a positive integer or null (unlimited)." });
      }
    }

    const { data: conference, error: fetchError } = await supabase
      .from("conferences")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    const { error: updateError } = await supabase
      .from("conferences")
      .update({ max_resubmissions: max_resubmissions === null ? null : parseInt(max_resubmissions, 10) })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({ message: "Error updating resubmission limit." });
    }

    return res.status(200).json({
      message: max_resubmissions === null
        ? "Resubmission limit removed. Authors may resubmit unlimited times."
        : `Resubmission limit set to ${max_resubmissions}.`,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error." });
  }
};
