import React, { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Loader2 } from "lucide-react";

const ADMIN_PORTAL_URL = "https://admin-fe-con-forum.vercel.app/login";

const roleDashboardMap = {
  organizer: "/userdashboard/organizer-dashboard",
  reviewer:  "/userdashboard/reviewer-dashboard",
  author:    "/userdashboard/author-dashboard",
};

const Login = () => {
  const { register, handleSubmit, formState: { errors } , setValue } = useForm();
  const [auth, setAuth, , fetchRoles] = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState("login");
  const [pendingUserId, setPendingUserId] = useState(null);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const otpRefs = useRef([]);

  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteConferenceId, setInviteConferenceId] = useState("");
  const [inviteConferenceName, setInviteConferenceName] = useState("");
  const [tokenLoading, setTokenLoading] = useState(!!token);
  const [tokenValid, setTokenValid] = useState(!token);

  useEffect(() => {
    if (!token) return;
    const fetchInvite = async () => {
      try {
        const res = await axios.get(`/api/auth/invitation/${token}`);
        if (res.data.success) {
          const inviteData = res.data.data;
          setInviteEmail(inviteData.email);
          setInviteRole(inviteData.role);
          setInviteConferenceId(inviteData.conferenceId || "");
          setInviteConferenceName(inviteData.conferenceName || "");
          setValue("email", inviteData.email);
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch {
        setTokenValid(false);
      } finally {
        setTokenLoading(false);
      }
    };
    fetchInvite();
  }, [token, setValue]);

  const isAdminUser = (user) => {
    if (!user) return false;
    const r = user.role;
    return r === 1 || r === "1" || r === "admin";
  };

  const redirectToAdminPortal = () => {
    toast.error("Admin accounts must sign in through the Admin Portal.");
    setTimeout(() => { window.location.href = ADMIN_PORTAL_URL; }, 1500);
  };

  const completeLogin = async (responseData) => {
    const { user, token: authToken, roles } = responseData.data;
    if (isAdminUser(user)) { redirectToAdminPortal(); return; }

    toast.success(responseData.message || "Signed in successfully.");

    localStorage.setItem("token", authToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;

    const immediateRoles = roles || [];
    const immediateAuth = { user, token: authToken, roles: immediateRoles };
    setAuth(immediateAuth);
    localStorage.setItem("auth", JSON.stringify(immediateAuth));

    if (user?._id) {
      const freshRoles = await fetchRoles(user._id);
      const freshAuth = { user, token: authToken, roles: freshRoles || immediateRoles };
      localStorage.setItem("auth", JSON.stringify(freshAuth));
    }

    if (inviteRole && roleDashboardMap[inviteRole]) {
      navigate(roleDashboardMap[inviteRole]);
    } else {
      navigate(location.state || "/");
    }
  };

  // Step 1: send email → backend either returns trusted-device token or sends OTP
  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        email: data.email,
        ...(inviteRole && { role: inviteRole }),
        ...(inviteConferenceId && { conferenceId: inviteConferenceId }),
        ...(inviteConferenceName && { conferenceName: inviteConferenceName }),
        ...(token && { invitationToken: token }),
      };
      const res = await axios.post("/api/auth/login", payload, { withCredentials: true });
      if (res.data.success) {
        if (res.data.requiresOtp) {
          setPendingUserId(res.data.data.userId);
          setStep("otp");
          setOtpDigits(["", "", "", "", "", ""]);
          setOtpError("");
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } else {
          // Trusted device — backend returned access token directly
          if (isAdminUser(res.data.data?.user)) { redirectToAdminPortal(); return; }
          await completeLogin(res.data);
        }
      } else {
        toast.error(res.data.message || "Sign-in failed. Please try again.");
      }
    } catch (error) {
      const msg = error?.response?.data?.message;
      if (msg && !msg.toLowerCase().includes("server") && !msg.toLowerCase().includes("internal")) {
        toast.error(msg);
      } else {
        toast.error("Sign-in failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);
    setOtpError("");
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpVerify = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== 6) { setOtpError("Please enter the complete 6-digit code."); return; }
    setIsVerifying(true);
    try {
      const res = await axios.post(
        "/api/auth/verify-otp",
        { userId: pendingUserId, otp },
        { withCredentials: true }   // needed so the HttpOnly refresh cookie is saved
      );
      if (res.data.success) {
        await completeLogin(res.data);
      } else {
        setOtpError(res.data.message || "Incorrect code. Please try again.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message;
      setOtpError(msg || "Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Loading skeleton while invite token resolves ──
  if (tokenLoading) {
    return (
      <Layout title="PaperDesk - Sign In">
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <div className="space-y-3 mt-6">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Invalid invite token ──
  if (token && !tokenValid) {
    return (
      <Layout title="PaperDesk - Invalid Link">
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
              <p className="text-muted-foreground text-sm">
                This invitation link is no longer valid. Please request a new one from the conference organizer.
              </p>
              <Button className="mt-6" onClick={() => navigate("/login")}>Go to Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="PaperDesk - Sign In">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
        <div className="w-full max-w-md animate-fade-in">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {inviteRole
                ? `You have been invited to join as ${inviteRole}`
                : "Sign in to your PaperDesk account"}
            </p>
          </div>

          {/* ── Step 1: Email entry ── */}
          {step === "login" && (
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                  {inviteEmail && (
                    <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-medium text-primary">
                      Joining as: <span className="font-bold">{inviteEmail}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      disabled={!!inviteEmail}
                      {...register("email", {
                        required: "Email address is required.",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Please enter a valid email address.",
                        },
                      })}
                      className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-destructive text-xs font-medium">{errors.email.message}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</>
                      : "Continue with Email"}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  New to PaperDesk?{" "}
                  <button
                    onClick={() => navigate(token ? `/register?token=${token}` : "/register")}
                    className="text-primary font-semibold hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: OTP verification ── */}
          {step === "otp" && (
            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-center">Check your email</CardTitle>
                <CardDescription className="text-center">
                  We sent a 6-digit verification code. Enter it below.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="flex gap-2 justify-center mb-5">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 text-center text-lg font-bold rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-destructive text-xs text-center mb-4 font-medium">{otpError}</p>
                )}

                <Button onClick={handleOtpVerify} disabled={isVerifying} className="w-full" size="lg">
                  {isVerifying
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying…</>
                    : "Verify Code"}
                </Button>

                <button
                  onClick={() => { setStep("login"); setOtpError(""); }}
                  className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to sign in
                </button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default Login;