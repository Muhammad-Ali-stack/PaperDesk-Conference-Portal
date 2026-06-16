import crypto from "crypto";
import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";

/**
 * Sends an organizer invitation email and creates invitation record.
 * Only administrators can call this endpoint.
 * 
 * Email delivery failures are logged but do not prevent the invitation
 * record from being saved. Admins can share the link manually if needed.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.body.organizerEmail - Email address to invite
 * @param {string} [req.body.message] - Optional personal message from admin
 * @returns {200} Invitation created with emailSent status
 * @returns {400} Missing organizer email
 * @returns {500} Server error
 */
export const sendOrganizerInviteController = async (req, res) => {
  try {
    const { organizerEmail, message } = req.body;

    if (!organizerEmail) {
      return res.status(400).json({ message: "Editor email is required." });
    }

    // Generate unique invitation token
    const inviteToken = crypto.randomUUID();

    // Create invitation record in database
    await supabase.from("invitations").insert({
      email: organizerEmail,
      conference_id: null,
      role: "organizer",
      status: "pending",
      token: inviteToken,
    });

    // Construct invitation link with token
    const inviteLink = `${process.env.ORGANIZER_INVITE_URL}/login?role=organizer&token=${inviteToken}`;
    // Build HTML email content
    const emailHtml = `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Editor Invitation</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#4B707A; padding: 32px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800; letter-spacing:1px;">PaperDesk</h1>
              <p style="margin:6px 0 0; color:#d1e8eb; font-size:13px;">Conference Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 32px;">
              <h2 style="margin:0 0 8px; color:#1a1a1a; font-size:22px; font-weight:700;">
                You have been invited as an Editor
              </h2>
              <p style="margin:0 0 24px; color:#6b7280; font-size:14px;">
                You have been selected to manage a conference on PaperDesk.
              </p>
              ${message ? `
              <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin-bottom:28px;">
                <p style="margin:0 0 6px; font-size:11px; font-weight:700; color:#4B707A; text-transform:uppercase; letter-spacing:0.5px;">Message from Admin</p>
                <p style="margin:0; font-size:14px; color:#374151; line-height:1.7; white-space:pre-line;">${message}</p>
              </div>
              ` : ""}
              <p style="margin:0 0 24px; font-size:14px; color:#374151; line-height:1.7;">
                As an Editor, you will be responsible for creating and managing conference submissions, assigning reviewers, and making final decisions on papers.
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
                If you did not expect this invitation, you can safely ignore this email.
                Alternatively, copy and paste this link:
                <span style="color:#4B707A; word-break:break-all;">${inviteLink}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 40px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                Copyright ${new Date().getFullYear()} PaperDesk - Conference Management System
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

    // Send invitation email
    const { sent } = await sendMail({
      type: "admin",
      to: organizerEmail,
      subject: "Editor Invitation - PaperDesk",
      html: emailHtml,
    });

    return res.status(200).json({
      message: "Editor invitation created successfully.",
      emailSent: sent,
    });
  } catch (error) {
    console.error("sendOrganizerInviteController error:", error);
    return res.status(500).json({
      message: "Error sending Editor invitation.",
      error: error.message,
    });
  }
};

/**
 * Creates a new conference and assigns an organizer.
 * 
 * Security: userId is read from verified JWT token (req.user) instead of
 * request body. This prevents attackers from creating conferences under
 * other users' accounts.
 * 
 * Process:
 * 1. Validate all required fields
 * 2. Check for duplicate conference name/acronym
 * 3. Resolve organizer (admin can assign different user, otherwise caller is organizer)
 * 4. Insert conference record with organizer details
 * 5. Assign organizer role to the resolved organizer
 * 6. Remove placeholder NULL conference record if applicable
 * 
 * @param {Object} req - Express request object
 * @param {string} req.body.conferenceName - Full conference name
 * @param {string} req.body.acronym - Short unique acronym
 * @param {string} req.body.mode - Blind review mode: "single-blind" or "double-blind" or "open"
 * @param {Array<string>} req.body.expertise - Required reviewer expertise keywords
 * @param {string} req.body.startDate - Conference start date
 * @param {string} req.body.endDate - Conference end date
 * @param {number} [req.body.max_resubmissions] - Max resubmissions per paper (null = unlimited)
 * @param {string} [req.body.webPage] - Conference website
 * @param {string} [req.body.venue] - Venue name
 * @param {string} [req.body.city] - City location
 * @param {string} [req.body.country] - Country location
 * @param {string} [req.body.abstractDeadline] - Abstract submission deadline
 * @param {string} [req.body.submissionDeadline] - Paper submission deadline
 * @param {string} [req.body.primaryArea] - Primary research area
 * @param {string} [req.body.secondaryArea] - Secondary research area
 * @param {Array<string>} [req.body.topics] - Conference topics
 * @param {string} [req.body.organizerEmail] - Email of organizer to assign (admin only)
 * @returns {201} Conference created successfully
 * @returns {400} Validation error or duplicate name/acronym
 * @returns {404} Organizer user not found
 * @returns {500} Server error
 */
export const createConferenceController = async (req, res) => {
  try {
    // Get authenticated user ID from JWT token
    const callerId = req.user._id || req.user.id;

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
      expertise,
      mode,
      max_resubmissions,
      organizerEmail,
    } = req.body;

    // Validate expertise is array
    if (!Array.isArray(expertise)) {
      return res.status(400).json({ message: "Expertise must be an array." });
    }

    // Validate required fields
    if (!conferenceName || !mode || !acronym || !startDate || !endDate || !expertise.length) {
      return res.status(400).json({
        message: "Conference name, acronym, start date, expertise, mode, and end date are required.",
      });
    }

    // Check for duplicate conference name or acronym
    const [{ data: existingByName }, { data: existingByAcronym }] = await Promise.all([
      supabase.from("conferences").select("id").eq("conference_name", conferenceName).maybeSingle(),
      supabase.from("conferences").select("id").eq("acronym", acronym).maybeSingle(),
    ]);

    if (existingByName || existingByAcronym) {
      return res.status(400).json({
        message: "A conference with the same name or acronym already exists.",
      });
    }

    // Validate and parse dates
    const startDateParsed = new Date(startDate);
    const endDateParsed = new Date(endDate);

    if (isNaN(startDateParsed) || isNaN(endDateParsed)) {
      return res.status(400).json({ message: "Invalid date format for startDate or endDate." });
    }

    // Determine the organizer (admin can assign someone else)
    const { data: callerUser } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("id", callerId)
      .maybeSingle();

    if (!callerUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const isAdmin = callerUser.role === 1;
    let organizerUser = callerUser;

    if (isAdmin && organizerEmail && organizerEmail.trim() !== "") {
      // Admin explicitly assigning someone else as organizer
      const { data: targetUser } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("email", organizerEmail.trim())
        .maybeSingle();

      if (!targetUser) {
        return res.status(404).json({
          message: `No account found for "${organizerEmail}". The Editor must have a PaperDesk account before a conference can be assigned.`,
        });
      }

      organizerUser = targetUser;
    }

    // Generate public submission link
    const submissionLink = `${process.env.BASE_URL}/conference/${acronym}/submit-paper/${acronym}`;

    // Insert new conference into database
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
        organizer_id: organizerUser.id,
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

    // Assign organizer role to the resolved organizer
    await supabase
      .from("user_conference_roles")
      .upsert(
        { user_id: organizerUser.id, conference_id: newConference.id, role: "organizer" },
        { onConflict: "user_id,conference_id,role" }
      );

    // Remove placeholder NULL conference record (for organizer invitation flow)
    await supabase
      .from("user_conference_roles")
      .delete()
      .eq("user_id", organizerUser.id)
      .eq("role", "organizer")
      .is("conference_id", null);

    return res.status(201).json({
      message: "Conference created successfully.",
      conference: newConference,
    });
  } catch (error) {
    console.error("createConferenceController error:", error);
    return res.status(500).json({ message: "Error creating conference." });
  }
};

/**
 * Retrieves a single conference by ID with all its submitted papers.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @returns {200} Conference object with papers array
 * @returns {400} Missing conference ID
 * @returns {404} Conference not found
 * @returns {500} Server error
 */
export const getConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Conference ID is required." });
    }

    // Fetch conference
    const { data: conference, error } = await supabase
      .from("conferences")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    // Fetch papers submitted to this conference
    const { data: papers } = await supabase
      .from("research_papers")
      .select("*, paper_authors(authors(first_name, email))")
      .eq("conference_id", id);

    return res.status(200).json({ ...conference, papers: papers || [] });
  } catch (error) {
    console.error("getConferenceController error:", error);
    return res.status(500).json({ message: "Error retrieving conference." });
  }
};

/**
 * Retrieves all conferences in the system.
 * Admin only endpoint.
 * 
 * @param {Object} req - Express request object
 * @returns {200} Array of all conference objects
 * @returns {404} No conferences found
 * @returns {500} Server error
 */
export const getAllConferencesController = async (req, res) => {
  try {
    const { data: conferences, error } = await supabase.from("conferences").select("*");

    if (error || !conferences || conferences.length === 0) {
      return res.status(404).json({ message: "No conferences found." });
    }

    return res.status(200).json(conferences);
  } catch (error) {
    console.error("getAllConferencesController error:", error);
    return res.status(500).json({ message: "Error retrieving conferences." });
  }
};

/**
 * Updates conference metadata fields.
 * Only admins or the conference organizer can update.
 * 
 * Security: Route middleware (isOrganizerRole) verifies user authorization.
 * Only provided fields are updated.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @param {Object} req.body - Fields to update
 * @returns {200} Updated conference object
 * @returns {403} User does not own this conference
 * @returns {404} Conference not found
 * @returns {500} Server error
 */
export const updateConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id;
    const userId = req.user._id || req.user.id;

    // Fetch conference to verify ownership
    const { data: conference } = await supabase
      .from("conferences")
      .select("organizer_id")
      .eq("id", conferenceId)
      .maybeSingle();

    if (!conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    // Check user authorization (admin or organizer)
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const isAdmin = user?.role === 1;
    const isOwner = conference.organizer_id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "You do not have permission to update this conference." });
    }

    // Extract update fields
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
      max_resubmissions,
    } = req.body;

    // Validate max_resubmissions if provided
    if (max_resubmissions !== undefined) {
      if (max_resubmissions !== null) {
        const parsed = parseInt(max_resubmissions, 10);
        if (isNaN(parsed) || parsed < 1) {
          return res.status(400).json({
            message: "max_resubmissions must be a positive integer or null (unlimited).",
          });
        }
      }
    }

    // Build update object with only provided fields
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
    if (max_resubmissions !== undefined) {
      updatedData.max_resubmissions = max_resubmissions === null ? null : parseInt(max_resubmissions, 10);
    }

    // Apply updates
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
    console.error("updateConferenceController error:", error);
    return res.status(500).json({ message: "Error updating conference." });
  }
};

/**
 * Permanently deletes a conference and all associated data.
 * Admin only - enforced by route middleware.
 * 
 * Deletion process:
 * 1. Fetch all papers for this conference
 * 2. Delete associated PDF files from storage
 * 3. Delete paper records
 * 4. Delete conference record (cascades handle related records)
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @returns {200} Deleted conference object
 * @returns {404} Conference not found
 * @returns {500} Server error
 */
export const deleteConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id;

    // Check conference exists
    const { data: conference, error: fetchError } = await supabase
      .from("conferences")
      .select("id")
      .eq("id", conferenceId)
      .maybeSingle();

    if (fetchError || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    // Fetch all papers to delete their files
    const { data: papers } = await supabase
      .from("research_papers")
      .select("id, paper_file_path")
      .eq("conference_id", conferenceId);

    // Delete PDF files from storage
    if (papers && papers.length > 0) {
      const fileNames = papers
        .map((p) => p.paper_file_path?.split("/").pop())
        .filter(Boolean);

      if (fileNames.length > 0) {
        await supabase.storage.from("paper-submissions").remove(fileNames);
      }

      // Delete paper records
      const paperIds = papers.map((p) => p.id);
      await supabase.from("research_papers").delete().in("id", paperIds);
    }

    // Delete conference (cascades handle related records)
    const { data: deletedConference, error } = await supabase
      .from("conferences")
      .delete()
      .eq("id", conferenceId)
      .select()
      .maybeSingle();

    if (error || !deletedConference) {
      return res.status(500).json({ message: "Error deleting conference." });
    }

    return res.status(200).json({
      message: "Conference deleted successfully.",
      conference: deletedConference,
    });
  } catch (error) {
    console.error("deleteConferenceController error:", error);
    return res.status(500).json({ message: "Error deleting conference." });
  }
};

/**
 * Retrieves all conferences with status "pending" (awaiting admin approval).
 * Admin only - enforced by route middleware.
 * 
 * @param {Object} req - Express request object
 * @returns {200} Array of pending conferences (empty array if none)
 * @returns {500} Server error
 */
export const getPendingConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("conferences")
      .select("*")
      .eq("status", "pending");
    
    if (error) {
      return res.status(500).json({ message: "Error retrieving pending conferences." });
    }
    
    return res.status(200).json(data || []);
  } catch (error) {
    console.error("getPendingConferencesController error:", error);
    return res.status(500).json({ message: "Error retrieving pending conferences." });
  }
};

/**
 * Retrieves all conferences with status "approved".
 * Public endpoint - no authentication required.
 * 
 * @param {Object} req - Express request object
 * @returns {200} Array of approved conferences (empty array if none)
 * @returns {500} Server error
 */
export const getApprovedConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("conferences")
      .select("*")
      .eq("status", "approved");
    
    if (error) {
      return res.status(500).json({ message: "Error retrieving approved conferences." });
    }
    
    return res.status(200).json(data || []);
  } catch (error) {
    console.error("getApprovedConferencesController error:", error);
    return res.status(500).json({ message: "Error retrieving approved conferences." });
  }
};

/**
 * Retrieves all conferences with status "rejected".
 * Admin only - enforced by route middleware.
 * 
 * @param {Object} req - Express request object
 * @returns {200} Array of rejected conferences (empty array if none)
 * @returns {500} Server error
 */
export const getRejectedConferencesController = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("conferences")
      .select("*")
      .eq("status", "rejected");
    
    if (error) {
      return res.status(500).json({ message: "Error retrieving rejected conferences." });
    }
    
    return res.status(200).json(data || []);
  } catch (error) {
    console.error("getRejectedConferencesController error:", error);
    return res.status(500).json({ message: "Error retrieving rejected conferences." });
  }
};

/**
 * Sets a conference status to "approved".
 * Admin only - enforced by route middleware.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @returns {200} Updated conference object
 * @returns {404} Conference not found
 * @returns {500} Server error
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

    return res.status(200).json({ 
      message: "Conference approved.", 
      conference: updatedConference 
    });
  } catch (error) {
    console.error("approveConferenceController error:", error);
    return res.status(500).json({ message: "Error approving conference." });
  }
};

/**
 * Sets a conference status to "rejected".
 * Admin only - enforced by route middleware.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @returns {200} Updated conference object
 * @returns {404} Conference not found
 * @returns {500} Server error
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

    return res.status(200).json({ 
      message: "Conference rejected.", 
      conference: updatedConference 
    });
  } catch (error) {
    console.error("rejectConferenceController error:", error);
    return res.status(500).json({ message: "Error rejecting conference." });
  }
};

/**
 * Returns the full conference name for a given acronym.
 * Used by public paper submission page to resolve conference
 * before user authentication.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.acronym - Conference acronym (e.g., "ICSE25")
 * @returns {200} Conference name
 * @returns {404} Conference not found
 * @returns {500} Server error
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
    console.error("getConferenceByAcronymController error:", error);
    return res.status(500).json({ message: "Error fetching conference details." });
  }
};

/**
 * Retrieves all papers submitted to a conference with reviewer information.
 * Enriches papers with:
 * - Assigned reviewers and their status (pending or reviewed)
 * - Review recommendations and scores
 * - Author details
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.conferenceId - Conference UUID
 * @returns {200} Array of papers with reviewer details
 * @returns {404} No papers found
 * @returns {500} Server error
 */
export const getPapersByConferenceController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    // Fetch papers
    const { data: papers, error: papersError } = await supabase
      .from("research_papers")
      .select("*, paper_authors(authors(first_name, email))")
      .eq("conference_id", conferenceId);

    if (papersError) {
      return res.status(500).json({ message: "Error retrieving papers." });
    }

    // Fetch reviews
    const { data: allReviews } = await supabase
      .from("reviews")
      .select("id, paper_id, reviewer_id, overall_recommendation, technical_confidence");

    // Fetch assignments
    const { data: allAssignments } = await supabase
      .from("assignments")
      .select("id, paper_id, reviewer_id, users!reviewer_id(name)")
      .eq("conference_id", conferenceId);

    // Enrich papers with reviewer information
    const enrichedPapers = (papers || []).map((paper) => {
      const paperAssignments = (allAssignments || []).filter(
        (a) => a.paper_id === paper.id
      );

      // Map reviewers with their status
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

      // Extract author details
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
    console.error("getPapersByConferenceController error:", error);
    return res.status(500).json({ message: "Error retrieving papers." });
  }
};

/**
 * Retrieves resubmission status for a specific paper.
 * Shows max allowed resubmissions, current count, and whether
 * the author can still resubmit.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.conferenceId - Conference UUID
 * @param {string} req.params.paperId - Paper UUID
 * @returns {200} Resubmission status information
 * @returns {400} Missing parameters
 * @returns {404} Conference or paper not found
 * @returns {500} Server error
 */
export const getSubmissionStatusController = async (req, res) => {
  try {
    const { conferenceId, paperId } = req.params;

    if (!conferenceId || !paperId) {
      return res.status(400).json({ 
        message: "Conference ID and Paper ID are required." 
      });
    }

    // Fetch conference and paper in parallel
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

    // Verify paper belongs to conference
    if (paper.conference_id !== conferenceId) {
      return res.status(400).json({ message: "Paper does not belong to this conference." });
    }

    // Calculate resubmission status
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
    console.error("getSubmissionStatusController error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

/**
 * Sets the maximum number of resubmissions allowed for a conference.
 * Pass null to allow unlimited resubmissions.
 * 
 * Only the admin or conference organizer can call this endpoint.
 * Authorization is enforced by route middleware.
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Conference UUID
 * @param {number|null} req.body.max_resubmissions - Positive integer or null for unlimited
 * @returns {200} Confirmation message
 * @returns {400} Invalid value for max_resubmissions
 * @returns {404} Conference not found
 * @returns {500} Server error
 */
export const setMaxResubmissionsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { max_resubmissions } = req.body;

    // Validate max_resubmissions value
    if (max_resubmissions !== null && max_resubmissions !== undefined) {
      const parsed = parseInt(max_resubmissions, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({ 
          message: "max_resubmissions must be a positive integer or null (unlimited)." 
        });
      }
    }

    // Check conference exists
    const { data: conference, error: fetchError } = await supabase
      .from("conferences")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    // Update resubmission limit
    const { error: updateError } = await supabase
      .from("conferences")
      .update({ 
        max_resubmissions: max_resubmissions === null ? null : parseInt(max_resubmissions, 10) 
      })
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
    console.error("setMaxResubmissionsController error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};