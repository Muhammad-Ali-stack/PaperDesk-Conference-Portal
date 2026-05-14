import { comparePassword, hashPassword } from "../utils_helpers/authHelper.js";
import JWT from "jsonwebtoken";
import supabase from "../config/supabase.js";

/*
 * Registers a new reviewer account.
 * If the email is already registered, returns an appropriate message
 * without creating a duplicate record.
 */
export const reviewerRegisterController = async (req, res) => {
  try {
    const { name, email, password, expertise } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required." });
    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!password) return res.status(400).json({ message: "Password is required." });
    if (!expertise) return res.status(400).json({ message: "Expertise is required." });

    const { data: existingReviewer } = await supabase
      .from("reviewers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingReviewer) {
      return res.status(200).json({
        success: false,
        message: "Reviewer already registered. Please log in directly.",
      });
    }

    const hashedPassword = await hashPassword(password);
    const expertiseArr = Array.isArray(expertise) ? expertise : [expertise];

    const { data: reviewer, error } = await supabase
      .from("reviewers")
      .insert({ name, email, password: hashedPassword, expertise: expertiseArr })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: "Error during registration." });
    }

    return res.status(201).json({
      success: true,
      message: "Registered successfully.",
      reviewer,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error during registration." });
  }
};

/*
 * Authenticates a reviewer by email and password.
 * Returns a signed JWT valid for 3 days on success.
 */
export const reviewerLoginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    const { data: reviewer, error } = await supabase
      .from("reviewers")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !reviewer) {
      return res.status(404).json({ success: false, message: "Email is not registered." });
    }

    const match = await comparePassword(password, reviewer.password);
    if (!match) {
      return res.status(200).json({ success: false, message: "Password does not match." });
    }

    const token = JWT.sign({ _id: reviewer.id }, process.env.JWT_SECRET, { expiresIn: "3d" });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      reviewer: {
        _id: reviewer.id,
        name: reviewer.name,
        email: reviewer.email,
        expertise: reviewer.expertise,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error during login." });
  }
};

/*
 * Checks whether a user is already registered as a reviewer for a
 * specific conference. Returns { exists: true } or { exists: false }.
 */
export const checkReviewerDetailsController = async (req, res) => {
  try {
    const { email, conferenceId } = req.query;

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) return res.status(404).json({ message: "User not found." });

    const { data: roleEntry } = await supabase
      .from("user_conference_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("conference_id", conferenceId)
      .eq("role", "reviewer")
      .maybeSingle();

    return res.status(200).json({ exists: !!roleEntry });
  } catch (error) {
    return res.status(500).json({ message: "Error checking reviewer details." });
  }
};

/*
 * Returns all users who have accepted a reviewer role for a given conference.
 * Uses two separate queries instead of a join to avoid FK dependency issues.
 */
export const getAcceptedReviewersController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ error: "Conference ID is required." });
    }

    // Step 1 - get all user_ids with reviewer role for this conference
    const { data: roles, error: rolesError } = await supabase
      .from("user_conference_roles")
      .select("user_id")
      .eq("conference_id", conferenceId)
      .eq("role", "reviewer");

    if (rolesError) {
      return res.status(500).json({ success: false, error: "Error fetching reviewer roles." });
    }

    if (!roles || roles.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const userIds = roles.map((r) => r.user_id);

    // Step 2 - fetch user details for those IDs
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds);

    if (usersError) {
      return res.status(500).json({ success: false, error: "Error fetching user details." });
    }

    // Shape the response to match what the frontend expects:
    // [{ user_id, users: { id, name, email } }]
    const reviewers = (users || []).map((user) => ({
      user_id: user.id,
      users: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    }));

    return res.status(200).json({ success: true, data: reviewers });
  } catch (error) {
    return res.status(500).json({ success: false, error: "An error occurred while fetching reviewers." });
  }
};

/*
 * Records a reviewer's response (accepted or declined) to an invitation.
 * On acceptance, the reviewer is added to the conference role in
 * user_conference_roles if a user_id is attached to the invitation.
 */
export const respondToInvitationController = async (req, res) => {
  try {
    const { conferenceId, email, status } = req.body;

    let query = supabase.from("invitations").select("*");
    if (conferenceId) query = query.eq("conference_id", conferenceId);
    if (email) query = query.eq("email", email);
    query = query.maybeSingle();

    const { data: invitation, error: invError } = await query;

    if (invError || !invitation) {
      return res.status(404).json({ success: false, message: "Invitation not found." });
    }

    await supabase.from("invitations").update({ status }).eq("id", invitation.id);

    if (status === "accepted" && invitation.user_id && invitation.conference_id) {
      const invitedRole = invitation.role || "reviewer";
      await supabase
        .from("user_conference_roles")
        .upsert(
          { user_id: invitation.user_id, conference_id: invitation.conference_id, role: invitedRole },
          { onConflict: "user_id,conference_id,role" }
        );
    }

    return res.status(200).json({ success: true, message: "Response recorded successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "An error occurred." });
  }
};

/*
 * Returns all papers assigned to a specific reviewer, including
 * paper metadata and author details.
 */
export const getAssignedPapersForReviewerController = async (req, res) => {
  const { reviewerId } = req.params;

  try {
    if (!reviewerId) {
      return res.status(400).json({ error: "Reviewer ID is required." });
    }

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select("assigned_at, conference_id, conferences!conference_id(conference_name, acronym), paper_id, research_papers!paper_id(id, title, abstract, keywords, paper_file_path, conference_name, conference_acronym, status, final_decision, paper_authors(authors(first_name, last_name, email, affiliation)))")
      .eq("reviewer_id", reviewerId);

    if (error || !assignments || assignments.length === 0) {
      return res.status(404).json({ error: "No assigned papers found for this reviewer." });
    }

    const { data: reviewsDone } = await supabase
      .from("reviews")
      .select("paper_id")
      .eq("reviewer_id", reviewerId);

    const reviewedPaperIds = new Set((reviewsDone || []).map((r) => r.paper_id));

    const assignedPapers = assignments.map((assignment) => {
      const paper = assignment.research_papers;
      if (!paper) return null;

      const authors = (paper.paper_authors || []).map((pa) => ({
        firstName: pa.authors?.first_name,
        lastName: pa.authors?.last_name,
        email: pa.authors?.email,
        affiliation: pa.authors?.affiliation,
      }));

      return {
  paperId: paper.id,
  title: paper.title,
  abstract: paper.abstract,
  keywords: paper.keywords,
  paperFilePath: paper.paper_file_path,
  conferenceName: paper.conference_name,
  conferenceAcronym: paper.conference_acronym,
  assignedAt: assignment.assigned_at,
  status: paper.status,
  finalDecision: paper.final_decision ?? null, 
  authors,
  isReviewedBy: reviewedPaperIds.has(paper.id) ? [reviewerId] : [],
};
    }).filter(Boolean);

    return res.status(200).json({ success: true, data: assignedPapers });
  } catch (error) {
    return res.status(500).json({ success: false, error: "An error occurred while fetching assigned papers." });
  }
};

/*
 * Submits a review form for a specific paper.
 *
 * Calculates a weighted technical confidence score using the conference's
 * custom weightage settings, or falls back to default weights if none
 * are configured.
 */
export const submitReviewFormController = async (req, res) => {
  try {
    const {
      paperId,
      reviewerId,
      originality,
      technicalQuality,
      significance,
      clarity,
      relevance,
      overallRecommendation,
      commentsForAuthors,
      commentsForOrganizers,
    } = req.body;

    if (!paperId || !reviewerId) {
      return res.status(400).json({ message: "Paper ID and Reviewer ID are required." });
    }

    const { data: paper, error: paperError } = await supabase
      .from("research_papers")
      .select("id, conference_id")
      .eq("id", paperId)
      .maybeSingle();

    if (paperError || !paper) {
      return res.status(404).json({ message: "Paper not found." });
    }

    let { data: weightage } = await supabase
      .from("technical_weightage")
      .select("*")
      .eq("conference_id", paper.conference_id)
      .maybeSingle();

    if (!weightage) {
      weightage = { originality: 30, technical_quality: 25, significance: 20, clarity: 15, relevance: 10 };
    }

    const technicalConfidence =
      (originality * weightage.originality) / 100 +
      (technicalQuality * (weightage.technical_quality || weightage.technicalQuality)) / 100 +
      (significance * weightage.significance) / 100 +
      (clarity * weightage.clarity) / 100 +
      (relevance * weightage.relevance) / 100;

    const { data: savedReview, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        paper_id: paperId,
        reviewer_id: reviewerId,
        originality,
        technical_quality: technicalQuality,
        significance,
        clarity,
        relevance,
        overall_recommendation: overallRecommendation,
        comments_for_authors: commentsForAuthors,
        comments_for_organizers: commentsForOrganizers,
        technical_confidence: technicalConfidence,
      })
      .select()
      .single();

    if (reviewError) {
      return res.status(500).json({ message: "Failed to submit review." });
    }

    await supabase
      .from("research_papers")
      .update({ status: "reviewed" })
      .eq("id", paperId);

    return res.status(200).json({
      success: true,
      message: "Review submitted successfully.",
      review: savedReview,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit review." });
  }
};
