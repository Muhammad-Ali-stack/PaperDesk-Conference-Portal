import crypto from "crypto";
import { comparePassword, hashPassword } from "../utils_helpers/authHelper.js";
import JWT from "jsonwebtoken";
import bcrypt from "bcrypt";
import supabase from "../config/supabase.js";
import { sendMail, isEmailReady } from "../config/mailer.js";

/** Number of minutes a one-time password remains valid before expiring. */
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generates a cryptographically random 6-digit numeric OTP string.
 *
 * @returns {string} A 6-digit OTP code.
 */
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Builds the HTML body for the OTP verification email.
 *
 * @param {string} name - Recipient's display name.
 * @param {string} otp  - The 6-digit OTP to embed in the email.
 * @returns {string} Full HTML email string.
 */
const otpEmailHtml = (name, otp) => `
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
              <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">Your Login Verification Code</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Hi ${name}, use the code below to complete your sign-in. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4B707A;">${otp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">If you did not request this code, please ignore this email. Your account remains secure.</p>
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
`;

/**
 * Registers a new user account, or updates roles for an existing user.
 *
 * Behaviour:
 * - If the email already exists and NO role is provided (simple registration),
 *   returns 409 Conflict with message to sign in instead.
 * - If email exists but user is adding a reviewer or organizer role via invitation,
 *   the role is added to the existing account.
 * - If `role` is "organizer", validates a pending organizer invitation before
 *   allowing registration and marks the invitation as accepted on success.
 * - If `role` is "reviewer", upserts a reviewer role record for the given
 *   `conferenceId` with the provided `expertise`.
 *
 * @route POST /api/v1/auth/register
 * @param {string} req.body.name
 * @param {string} req.body.email
 * @param {string} req.body.password
 * @param {string} req.body.phone
 * @param {string} req.body.address
 * @param {string} req.body.recovery_key
 * @param {string} [req.body.role]            - "organizer" or "reviewer" for invitation flows.
 * @param {string} [req.body.invitationToken] - Token from the invitation email.
 * @param {string} [req.body.conferenceId]    - Required when role is "reviewer".
 * @param {string|string[]} [req.body.expertise] - Reviewer expertise areas.
 * @returns {201} User registered successfully.
 * @returns {200} Existing user — roles and conferences updated.
 * @returns {400} Missing required fields.
 * @returns {403} No valid organizer invitation found.
 * @returns {409} Email already registered (when no role provided).
 * @returns {500} Database or server error.
 */
export const registerController = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      recovery_key,
      expertise,
      conferenceId,
      role,
      invitationToken,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Name is required." });
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });
    if (!password) return res.status(400).json({ success: false, message: "Password is required." });
    if (!phone) return res.status(400).json({ success: false, message: "Phone is required." });

    if (!recovery_key) return res.status(400).json({ success: false, message: "Recovery key is required." });

    /**
     * Looks up a pending invitation by token (preferred) or by email.
     *
     * @param {string} roleFilter - The role to match in the invitations table.
     * @returns {Object|null} The invitation row, or null if not found.
     */
    const findInvitation = async (roleFilter) => {
      if (invitationToken) {
        const { data } = await supabase
          .from("invitations")
          .select("id, email, conference_id")
          .eq("token", invitationToken)
          .eq("role", roleFilter)
          .eq("status", "pending")
          .maybeSingle();
        return data;
      }
      const { data } = await supabase
        .from("invitations")
        .select("id, email, conference_id")
        .eq("email", email)
        .eq("role", roleFilter)
        .eq("status", "pending")
        .maybeSingle();
      return data;
    };

    if (role === "organizer") {
      const invitation = await findInvitation("organizer");
      if (!invitation) {
        return res.status(403).json({ success: false, message: "No valid organizer invitation found." });
      }
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      //  If user exists and NO role provided (simple registration), reject with 409
      if (!role || (role !== "reviewer" && role !== "organizer")) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered. Please sign in instead.",
        });
      }

      // Allow adding reviewer role for existing user
      if (role === "reviewer" && expertise && conferenceId) {
        await supabase
          .from("user_conference_roles")
          .upsert(
            {
              user_id: existingUser.id,
              conference_id: conferenceId,
              role: "reviewer",
              expertise: Array.isArray(expertise) ? expertise : [expertise],
            },
            { onConflict: "user_id,conference_id,role" }
          );
        return res.status(200).json({
          success: true,
          message: "Reviewer role added to existing account.",
          data: { user: existingUser },
        });
      }

      // Allow adding organizer role for existing user with valid invitation
      if (role === "organizer") {
        const invitation = await findInvitation("organizer");
        if (!invitation) {
          return res.status(403).json({ success: false, message: "No valid organizer invitation found." });
        }
        const { error: upsertError } = await supabase
          .from("user_conference_roles")
          .insert({ user_id: existingUser.id, conference_id: null, role: "organizer" });

        if (upsertError && !upsertError.message.includes("duplicate")) {
          console.error("[register] organizer role insert error:", upsertError.message);
        }

        await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);
        return res.status(200).json({
          success: true,
          message: "Organizer role added to existing account.",
          data: { user: existingUser },
        });
      }

      // Fallback: if we reach here, email exists but no valid role action
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please sign in instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedRecoveryKey = await bcrypt.hash(recovery_key, 10);
    const { data: savedUser, error: insertError } = await supabase
      .from("users")
     .insert({ name, email, password: hashedPassword, phone, ...(address && { address }), recovery_key: hashedRecoveryKey })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ success: false, message: "Error registering user." });
    }

    if (role === "reviewer" && expertise && conferenceId) {
      await supabase
        .from("user_conference_roles")
        .insert({
          user_id: savedUser.id,
          conference_id: conferenceId,
          role: "reviewer",
          expertise: Array.isArray(expertise) ? expertise : [expertise],
        });
    }

    if (role === "organizer") {
      const invitation = await findInvitation("organizer");
      if (!invitation) {
        await supabase.from("users").delete().eq("id", savedUser.id);
        return res.status(403).json({ success: false, message: "No valid organizer invitation found." });
      }
      await supabase
        .from("user_conference_roles")
        .insert({ user_id: savedUser.id, conference_id: null, role: "organizer" });

      await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: { user: savedUser },
    });
  } catch (error) {
    console.error("[register] Unexpected error:", error.message);
    return res.status(500).json({ success: false, message: "Error registering user." });
  }
};

/**
 * Authenticates a user by email and password, then initiates the OTP flow.
 *
 * Behaviour:
 * - Validates credentials against the database.
 * - If `role` is "reviewer" and `conferenceId` is present, upserts the
 *   reviewer role and marks the invitation as accepted (sign-in invitation flow).
 * - If `role` is "organizer" and `invitationToken` is present, inserts the
 *   organizer role and marks the invitation as accepted (sign-in invitation flow).
 * - On successful credential check, generates a 6-digit OTP, stores it, and
 *   sends it to the user's email. Login is NOT completed until the OTP is verified
 *   via the `verifyOtp` endpoint.
 * - If the email service is not configured, login is blocked with a clear message.
 *
 * @route POST /api/v1/auth/login
 * @param {string} req.body.email
 * @param {string} req.body.password
 * @param {string} [req.body.role]            - "organizer" or "reviewer" for invitation flows.
 * @param {string} [req.body.conferenceId]    - Required for reviewer invitation sign-in.
 * @param {string} [req.body.invitationToken] - Required for organizer invitation sign-in.
 * @param {string|string[]} [req.body.expertise] - Reviewer expertise (optional for sign-in flow).
 * @returns {200} OTP sent — `{ requiresOtp: true, userId }`.
 * @returns {400} Missing email or password.
 * @returns {404} Email not registered.
 * @returns {503} Email service not configured.
 * @returns {500} OTP delivery failure or server error.
 */
export const loginController = async (req, res) => {
  try {
    const { email, password, role, conferenceId, invitationToken, expertise } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, message: "Email is not registered." });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(200).json({ success: false, message: "Password does not match." });
    }

    if (role === "reviewer" && conferenceId) {
      const expertiseArr = expertise
        ? Array.isArray(expertise) ? expertise : [expertise]
        : [];
      await supabase
        .from("user_conference_roles")
        .upsert(
          {
            user_id: user.id,
            conference_id: conferenceId,
            role: "reviewer",
            ...(expertiseArr.length > 0 ? { expertise: expertiseArr } : {}),
          },
          { onConflict: "user_id,conference_id,role" }
        );
      if (invitationToken) {
        await supabase
          .from("invitations")
          .update({ status: "accepted" })
          .eq("token", invitationToken)
          .eq("status", "pending");
      }
    }

    if (role === "organizer" && invitationToken) {
      const { data: invitation } = await supabase
        .from("invitations")
        .select("id, email")
        .eq("token", invitationToken)
        .eq("role", "organizer")
        .eq("status", "pending")
        .maybeSingle();

      if (invitation) {
        const { error: insertError } = await supabase
          .from("user_conference_roles")
          .insert({ user_id: user.id, conference_id: null, role: "organizer" });

        if (!insertError || insertError.message.includes("duplicate")) {
          await supabase
            .from("invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);
        }
      }
    }

    if (!isEmailReady()) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured. Please contact the administrator to enable OTP login.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase.from("login_otps").insert({
      user_id: user.id,
      otp_code: otp,
      expires_at: expiresAt,
    });

    const { sent, reason } = await sendMail({
      type: "otp",
      to: user.email,
      subject: "Your PaperDesk Login Code",
      html: otpEmailHtml(user.name, otp),
    });

    if (!sent) {
      console.error("[login] Failed to send OTP email:", reason);
      return res.status(500).json({
        success: false,
        message: `Verification code could not be delivered: ${reason}. Please try again or contact support.`,
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      data: { userId: user.id },
      message: `A verification code has been sent to ${user.email}. Please enter it to complete login.`,
    });
  } catch (error) {
    console.error("[login] Unexpected error:", error.message);
    return res.status(500).json({ success: false, message: "Error during login." });
  }
};

/**
 * Verifies the 6-digit OTP submitted after a successful credential check.
 * On success, marks the OTP as used and returns a signed JWT valid for 7 days,
 * along with the user profile and all conference roles.
 *
 * @route POST /api/v1/auth/verify-otp
 * @param {string} req.body.userId - The user ID returned by the login endpoint.
 * @param {string} req.body.otp    - The 6-digit code the user received by email.
 * @returns {200} Login complete — `{ token, user, roles }`.
 * @returns {400} Missing userId or otp.
 * @returns {401} Invalid or expired OTP.
 * @returns {500} Server error.
 */
export const verifyOtpController = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "User ID and OTP are required." });
    }

    const { data: otpRecord } = await supabase
      .from("login_otps")
      .select("*")
      .eq("user_id", userId)
      .eq("otp_code", otp)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return res.status(401).json({ success: false, message: "Invalid or expired verification code." });
    }

    await supabase.from("login_otps").update({ used: true }).eq("id", otpRecord.id);

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

    const token = JWT.sign({ _id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    const { data: userRoles } = await supabase
      .from("user_conference_roles")
      .select("role, conference_id, expertise")
      .eq("user_id", user.id);

    const roles = userRoles
      ? userRoles.map((r) => ({
          role: r.role,
          conferenceId: r.conference_id,
          expertise: r.expertise,
        }))
      : [];

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      data: {
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          address: user.address,
          phone: user.phone,
          role: user.role,
        },
        roles,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error verifying OTP." });
  }
};

/**
 * Returns the invitation details associated with a given token.
 * Used by the frontend to pre-fill the registration/sign-in form
 * with the invited email address, role, and conference name.
 *
 * @route GET /api/v1/auth/invitation/:token
 * @param {string} req.params.token - The invitation token from the email link.
 * @returns {200} Invitation data — `{ email, role, conferenceId, conferenceName, conferenceAcronym }`.
 * @returns {400} Token parameter is missing.
 * @returns {404} Invitation not found or already accepted.
 * @returns {500} Server error.
 */
export const getInvitationByTokenController = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required." });
    }

    const { data: invitation } = await supabase
      .from("invitations")
      .select("email, role, conference_id, status, conferences!conference_id(conference_name, acronym, expertise)") //  added expertise
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!invitation) {
      return res.status(404).json({ success: false, message: "Invitation not found or already used." });
    }

    return res.status(200).json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        conferenceId: invitation.conference_id,
        conferenceName: invitation.conferences?.conference_name || null,
        conferenceAcronym: invitation.conferences?.acronym || null,
        expertise: invitation.conferences?.expertise || [], //  added
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching invitation." });
  }
};

/**
 * Resets a user's password using their registered email and recovery key.
 * No OTP or session is required — the recovery key acts as the second factor.
 *
 * @route POST /api/v1/auth/forgot-password
 * @param {string} req.body.email        - The user's registered email address.
 * @param {string} req.body.recovery_key - The recovery key set during registration.
 * @param {string} req.body.newPassword  - The new password to set.
 * @returns {200} Password reset successfully.
 * @returns {400} Missing required fields.
 * @returns {404} Wrong email or recovery key.
 * @returns {500} Server error.
 */
export const forgotPasswordController = async (req, res) => {
  try {
    const { email, recovery_key, newPassword } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });
    if (!recovery_key) return res.status(400).json({ success: false, message: "Recovery key is required." });
    if (!newPassword) return res.status(400).json({ success: false, message: "New password is required." });

    const { data: user } = await supabase
      .from("users")
      .select("id, recovery_key")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ success: false, message: "Wrong email or recovery key." });
    }

    const isRecoveryKeyValid = await bcrypt.compare(recovery_key, user.recovery_key);
    if (!isRecoveryKeyValid) {
      return res.status(404).json({ success: false, message: "Wrong email or recovery key." });
    }

    const hashed = await hashPassword(newPassword);
    await supabase.from("users").update({ password: hashed }).eq("id", user.id);

    return res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

/**
 * Updates the authenticated user's profile fields.
 * Only the provided fields are updated; omitted fields retain their current values.
 * If a new password is provided it must be at least 6 characters and is hashed before storage.
 *
 * @route PUT /api/v1/auth/update-profile
 * @param {string} [req.body.name]     - New display name.
 * @param {string} [req.body.password] - New password (min 6 characters).
 * @param {string} [req.body.address]  - New address.
 * @param {string} [req.body.phone]    - New phone number.
 * @returns {200} Profile updated successfully — returns the updated user object.
 * @returns {400} Validation error or update failure.
 */
export const updateProfileController = async (req, res) => {
  try {
    const { name, password, address, phone } = req.body;
    const userId = req.user._id || req.user.id;

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

    if (password && password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const updates = {
      name: name || user.name,
      phone: phone || user.phone,
      address: address || user.address,
    };

    if (password) {
      updates.password = await hashPassword(password);
    }

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: "Error updating profile." });
    }

    return res.status(200).json({ success: true, message: "Profile updated successfully.", data: { updatedUser } });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Error updating profile." });
  }
};

/**
 * Returns all conference roles assigned to a given user.
 * Each entry includes the role name, conference details, expertise (for reviewers),
 * and an `awaitingConference` flag for organizers who have not yet created a conference.
 *
 * @route GET /api/v1/auth/user-roles/:userId
 * @param {string} req.params.userId - The user ID to look up.
 * @returns {200} `{ roles: Array }` — empty array if no roles found.
 * @returns {500} Server error.
 */
export const getUserRolesController = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: userRoles, error } = await supabase
      .from("user_conference_roles")
      .select("role, expertise, conference_id, conferences(id, conference_name, acronym, status)")
      .eq("user_id", userId);

    if (error || !userRoles || userRoles.length === 0) {
      return res.status(200).json({ success: true, data: { roles: [] } });
    }

    const roles = userRoles
      .filter((r) => r.conferences !== null || r.role === "organizer")
      .map((r) => ({
        conferenceId: r.conferences?.id || null,
        conferenceName: r.conferences?.conference_name || null,
        acronym: r.conferences?.acronym || null,
        status: r.conferences?.status || null,
        role: r.role,
        expertise: r.role === "reviewer" ? r.expertise : undefined,
        awaitingConference: r.role === "organizer" && !r.conferences,
      }))
      .filter((r) => r.conferenceId !== null || (r.role === "organizer" && r.awaitingConference));

    return res.status(200).json({ success: true, data: { roles } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching roles." });
  }
};

/**
 * Returns all conferences associated with a user filtered by a specific role.
 *
 * @route GET /api/v1/auth/user-conferences/:userId?role=<role>
 * @param {string} req.params.userId - The user ID to look up.
 * @param {string} req.query.role    - Role to filter by ("author" | "reviewer" | "organizer").
 * @returns {200} `{ conferences: Array }` — empty array if none found.
 * @returns {400} Role query parameter is missing.
 * @returns {500} Server error.
 */
export const getUserConferencesByRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ success: false, message: "Role parameter is required." });
    }

    const { data: userRoles, error } = await supabase
      .from("user_conference_roles")
      .select("conferences(id, conference_name, acronym, status)")
      .eq("user_id", userId)
      .eq("role", role);

    if (error || !userRoles || userRoles.length === 0) {
      return res.status(200).json({ success: true, data: { conferences: [] } });
    }

    const conferences = userRoles
      .filter((r) => r.conferences)
      .map((r) => ({
        conferenceId: r.conferences.id,
        conferenceName: r.conferences.conference_name,
        acronym: r.conferences.acronym,
        status: r.conferences.status,
      }));

    return res.status(200).json({ success: true, data: { conferences } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching conferences." });
  }
};