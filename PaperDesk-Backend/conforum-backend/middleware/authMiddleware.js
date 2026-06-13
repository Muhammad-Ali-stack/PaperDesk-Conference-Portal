import JWT from "jsonwebtoken";
import supabase from "../config/supabase.js";

/**
 * Verifies the JWT bearer token from the Authorization header.
 * On success, attaches the decoded payload to `req.user` and calls `next()`.
 * Returns 401 if the token is missing, invalid, or expired.
 *
 * @middleware
 */
export const requireLogin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        name: "JsonWebTokenError",
        message: "No token provided or invalid format.",
      });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    const decode = JWT.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        name: "TokenExpiredError",
        message: "Token has expired.",
      });
    }
    return res.status(401).json({
      success: false,
      name: "JsonWebTokenError",
      message: "Invalid token.",
    });
  }
};

/**
 * Restricts access to users whose `role` column equals `1` (admin).
 * Must be chained after `requireLogin` so `req.user` is already populated.
 * Returns 403 for non-admin users.
 *
 * @middleware
 */
export const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !user || user.role !== 1) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Admins only.",
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in admin authorization.",
    });
  }
};

/**
 * Factory that returns a middleware which checks whether the authenticated
 * user holds a specific role (e.g. "organizer", "reviewer", "author") for
 * the conference identified by `req.params.conferenceId`.
 * Returns 403 if the user does not have that role on that conference.
 *
 * @param {string} role - The role to validate ("organizer" | "reviewer" | "author").
 * @returns {Function} Express middleware function.
 */
export const validateRole = (role) => {
  return async (req, res, next) => {
    const userId = req.user?._id || req.user?.id;
    const { conferenceId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }

    try {
      const { data, error } = await supabase
        .from("user_conference_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("conference_id", conferenceId)
        .eq("role", role)
        .maybeSingle();

      if (error || !data) {
        return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
      }

      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  };
};

/** Middleware: requires the user to be an organizer of the requested conference. */
export const isOrganizer = validateRole("organizer");

/** Middleware: requires the user to be a reviewer of the requested conference. */
export const isReviewer = validateRole("reviewer");

/** Middleware: requires the user to be an author of the requested conference. */
export const isAuthor = validateRole("author");

/**
 * Checks whether the authenticated user holds the "organizer" role on
 * any conference (conference-agnostic organizer check).
 * Used on routes that require organizer identity but are not scoped to a
 * single conference (e.g. creating a new conference).
 * Returns 403 if the user has no organizer role anywhere.
 *
 * @middleware
 */
export const isOrganizerRole = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    const { data, error } = await supabase
      .from("user_conference_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "organizer")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only organizers can perform this action.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/**
 * Prevents a reviewer from submitting more than one review for the same paper.
 * Reads `paperId` and `reviewerId` from `req.body`.
 * Returns 400 if a review already exists for that paper-reviewer pair.
 *
 * @middleware
 */
export const checkIfReviewed = async (req, res, next) => {
  const { paperId, reviewerId } = req.body;

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id")
      .eq("paper_id", paperId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();

    if (data) {
      return res.status(400).json({ success: false, message: "You have already reviewed this paper." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};