import crypto from "crypto";
import JWT from "jsonwebtoken";
import bcrypt from "bcrypt";
import supabase from "../config/supabase.js";
import { sendMail, isEmailReady } from "../config/mailer.js";

const OTP_EXPIRY_MINUTES = 10;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MAX_OTP_ATTEMPTS = 10;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const thirtyDaysMs = () => REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

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
 * Fetches all non-expired trusted device records for a user.
 * @param {string} userId
 * @returns {Array} trusted device rows
 */
const getActiveTrustedDevices = async (userId) => {
  const { data } = await supabase
    .from("trusted_devices")
    .select("id, token_hash, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  return data || [];
};

/**
 * Fetches the user's conference roles.
 * @param {string} userId
 * @returns {Array} role objects
 */
const getUserRoles = async (userId) => {
  const { data: userRoles } = await supabase
    .from("user_conference_roles")
    .select("role, conference_id, expertise")
    .eq("user_id", userId);
  return (userRoles || []).map((r) => ({
    role: r.role,
    conferenceId: r.conference_id,
    expertise: r.expertise,
  }));
};

/**
 * Sets the refresh token as an HttpOnly cookie on the response.
 * @param {object} res - Express response object.
 * @param {string} token - Raw refresh token string.
 */
const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: thirtyDaysMs(),
    path: "/",
  });
};

/**
 * Clears the refresh token cookie.
 * @param {object} res - Express response object.
 */
const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", { path: "/" });
};

// ============================================================
// registerController
// ============================================================
export const registerController = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      expertise,
      conferenceId,
      role,
      invitationToken,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Name is required." });
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });
    if (!phone) return res.status(400).json({ success: false, message: "Phone is required." });

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
      if (!role || (role !== "reviewer" && role !== "organizer")) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered. Please sign in instead.",
        });
      }

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

      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please sign in instead.",
      });
    }

    const { data: savedUser, error: insertError } = await supabase
      .from("users")
      .insert({ name, email, phone, ...(address && { address }) })
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
// ============================================================
// loginController
// New flow:
//  1. Validate email → find user.
//  2. Handle invitation role side-effects (same as before).
//  3. If a valid refresh token cookie is present AND matches a
//     trusted_devices record → skip OTP, rotate refresh token,
//     issue a new 15-min access token, return immediately.
//  4. Otherwise → generate a hashed OTP, email it, return
//     { requiresOtp: true, userId }.
// ============================================================
export const loginController = async (req, res) => {
  try {
    const { email, role, conferenceId, invitationToken, expertise } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, message: "Email is not registered, please sign up first." });
    }

    // ── Invitation side-effects (role assignment) ──────────────
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

    // ── Trusted device check ───────────────────────────────────
    const rawRefreshToken = req.cookies?.refreshToken;
    if (rawRefreshToken) {
      const activeDevices = await getActiveTrustedDevices(user.id);
      for (const device of activeDevices) {
        const tokenMatch = await bcrypt.compare(rawRefreshToken, device.token_hash);
        if (tokenMatch) {
          // Valid trusted device — rotate refresh token & issue access token.
          const newRaw = crypto.randomBytes(64).toString("hex");
          const newHash = await bcrypt.hash(newRaw, 10);
          const newExpiry = new Date(Date.now() + thirtyDaysMs()).toISOString();

          await supabase
            .from("trusted_devices")
            .update({ token_hash: newHash, expires_at: newExpiry, last_used_at: new Date().toISOString() })
            .eq("id", device.id);

          const accessToken = JWT.sign({ _id: user.id }, process.env.JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRY,
          });

          setRefreshCookie(res, newRaw);

          const roles = await getUserRoles(user.id);

          return res.status(200).json({
            success: true,
            requiresOtp: false,
            message: "Authenticated via trusted device.",
            data: {
              token: accessToken,
              user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                address: user.address,
                phone: user.phone,
                role: user.role,
              },
              roles,
            },
          });
        }
      }
      // Cookie present but no matching record — fall through to OTP.
    }

    // ── OTP flow ───────────────────────────────────────────────
    if (!isEmailReady()) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured. Please contact the administrator to enable OTP login.",
      });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase.from("login_otps").insert({
      user_id: user.id,
      otp_code: otpHash,
      expires_at: expiresAt,
      attempts: 0,
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

// ============================================================
// verifyOtpController
// Verifies the hashed OTP. On success:
//  - Issues a 15-min JWT access token.
//  - Generates a 30-day refresh token and stores its hash in
//    trusted_devices.
//  - Sets the raw refresh token in an HttpOnly cookie.
//  - Returns the access token + user profile to the frontend.
// Brute-force protection: marks OTP as used after MAX_OTP_ATTEMPTS
// failed attempts so it can never be retried.
// ============================================================
export const verifyOtpController = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "User ID and OTP are required." });
    }

    // Fetch the most-recent non-expired, non-used OTP record for this user.
    const { data: otpRecord } = await supabase
      .from("login_otps")
      .select("*")
      .eq("user_id", userId)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return res.status(401).json({ success: false, message: "Invalid or expired verification code." });
    }

    // Brute-force guard: invalidate after too many attempts.
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await supabase.from("login_otps").update({ used: true }).eq("id", otpRecord.id);
      return res.status(401).json({
        success: false,
        message: "Too many failed attempts. Please request a new verification code.",
      });
    }

    // Constant-time hashed comparison.
    const isValid = await bcrypt.compare(otp, otpRecord.otp_code);

    if (!isValid) {
      await supabase
        .from("login_otps")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);
      return res.status(401).json({ success: false, message: "Invalid or expired verification code." });
    }

    // Mark OTP as used to prevent replay.
    await supabase.from("login_otps").update({ used: true }).eq("id", otpRecord.id);

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Generate access token (15 min) and refresh token (30 days).
    const accessToken = JWT.sign({ _id: user.id }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const rawRefreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const refreshExpiry = new Date(Date.now() + thirtyDaysMs()).toISOString();

    await supabase.from("trusted_devices").insert({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: refreshExpiry,
    });

    setRefreshCookie(res, rawRefreshToken);

    const roles = await getUserRoles(user.id);

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
        token: accessToken,
      },
    });
  } catch (error) {
    console.error("[verifyOtp] Unexpected error:", error.message);
    return res.status(500).json({ success: false, message: "Error verifying OTP." });
  }
};

// ============================================================
// refreshTokenController
// Validates the refresh token cookie, performs token rotation
// (deletes old record, inserts new one), and returns a fresh
// 15-min access token. No OTP required.
//
// @route POST /api/auth/refresh
// ============================================================
export const refreshTokenController = async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided." });
    }

    // Determine userId from the token if the JWT is supplied, or scan all users.
    // Prefer reading userId from request body for efficiency.
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required in the request body." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const activeDevices = await getActiveTrustedDevices(userId);
    let matchedDevice = null;

    for (const device of activeDevices) {
      const tokenMatch = await bcrypt.compare(rawRefreshToken, device.token_hash);
      if (tokenMatch) {
        matchedDevice = device;
        break;
      }
    }

    if (!matchedDevice) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please log in again.",
      });
    }

    // Rotate: delete old record, insert new one.
    await supabase.from("trusted_devices").delete().eq("id", matchedDevice.id);

    const newRaw = crypto.randomBytes(64).toString("hex");
    const newHash = await bcrypt.hash(newRaw, 10);
    const newExpiry = new Date(Date.now() + thirtyDaysMs()).toISOString();

    await supabase.from("trusted_devices").insert({
      user_id: userId,
      token_hash: newHash,
      expires_at: newExpiry,
    });

    const accessToken = JWT.sign({ _id: user.id }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    setRefreshCookie(res, newRaw);

    const roles = await getUserRoles(userId);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed.",
      data: {
        token: accessToken,
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          address: user.address,
          phone: user.phone,
          role: user.role,
        },
        roles,
      },
    });
  } catch (error) {
    console.error("[refreshToken] Unexpected error:", error.message);
    return res.status(500).json({ success: false, message: "Error refreshing token." });
  }
};

// ============================================================
// logoutController
// Normal logout: clears the access token on the client side
// only. Refresh token cookie is also cleared but the trusted
// device RECORD is preserved so the user can silently
// re-authenticate from the same device on next login.
//
// @route POST /api/auth/logout
// ============================================================
export const logoutController = async (req, res) => {
  try {
    clearRefreshCookie(res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Your device remains trusted for future logins.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error during logout." });
  }
};

// ============================================================
// logoutAllDevicesController
// Deletes ALL trusted_devices records for the authenticated
// user, clears the refresh token cookie, and forces OTP
// verification on the next login from every device.
//
// @route POST /api/auth/logout-all
// Requires: requireLogin middleware (Bearer access token).
// ============================================================
export const logoutAllDevicesController = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    await supabase.from("trusted_devices").delete().eq("user_id", userId);
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices. OTP will be required on next login from any device.",
    });
  } catch (error) {
    console.error("[logoutAll] Unexpected error:", error.message);
    return res.status(500).json({ success: false, message: "Error during logout." });
  }
};

// ============================================================
// getInvitationByTokenController (unchanged)
// ============================================================
export const getInvitationByTokenController = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required." });
    }

    const { data: invitation } = await supabase
      .from("invitations")
      .select("email, role, conference_id, status, conferences!conference_id(conference_name, acronym, expertise)")
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
        expertise: invitation.conferences?.expertise || [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching invitation." });
  }
};
// ============================================================
// updateProfileController (unchanged)
// ============================================================
export const updateProfileController = async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const userId = req.user._id || req.user.id;

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const updates = {
      name: name || user.name,
      phone: phone || user.phone,
      address: address || user.address,
    };

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: "Error updating profile." });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user: {
          _id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          address: updatedUser.address,
          role: updatedUser.role,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating profile." });
  }
};

// ============================================================
// getUserRolesController (unchanged)
// ============================================================
export const getUserRolesController = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: roles, error } = await supabase
      .from("user_conference_roles")
      .select("role, conference_id, expertise, conferences!conference_id(conference_name, acronym)")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching roles." });
    }

    return res.status(200).json({
      success: true,
      data: {
        roles: (roles || []).map((r) => ({
          role: r.role,
          conferenceId: r.conference_id,
          expertise: r.expertise,
          conferenceName: r.conferences?.conference_name || null,
          conferenceAcronym: r.conferences?.acronym || null,
          awaitingConference: !r.conference_id,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching user roles." });
  }
};

// ============================================================
// getUserConferencesByRole (unchanged)
// ============================================================
export const getUserConferencesByRole = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: roles, error } = await supabase
      .from("user_conference_roles")
      .select("role, conference_id, conferences!conference_id(id, conference_name, acronym, status)")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching conferences." });
    }

    return res.status(200).json({
      success: true,
      data: {
        conferences: (roles || [])
          .filter((r) => r.conferences)
          .map((r) => ({
            role: r.role,
            conference: r.conferences,
          })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching user conferences." });
  }
};
