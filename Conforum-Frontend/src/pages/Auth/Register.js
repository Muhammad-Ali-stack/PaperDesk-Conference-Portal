import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Loader2, Eye, EyeOff } from "lucide-react";

const passwordRules = {
  required: "Password is required.",
  minLength: { value: 8, message: "Password must be at least 8 characters." },
  validate: {
    hasUppercase: (v) => /[A-Z]/.test(v) || "Password must contain at least one uppercase letter.",
    hasLowercase: (v) => /[a-z]/.test(v) || "Password must contain at least one lowercase letter.",
    hasNumber:    (v) => /[0-9]/.test(v) || "Password must contain at least one number.",
  },
};

const Register = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteConferenceId, setInviteConferenceId] = useState("");
  const [inviteConferenceName, setInviteConferenceName] = useState("");
  const [tokenLoading, setTokenLoading] = useState(!!token);
  const [tokenValid, setTokenValid] = useState(!token);
  const [expertiseOptions, setExpertiseOptions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isReviewer = inviteRole === "reviewer";

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    defaultValues: { expertise: [] }
  });
  const navigate = useNavigate();
  const passwordValue = watch("password", "");

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

  useEffect(() => {
    if (!inviteConferenceId || inviteRole !== "reviewer") return;
    const fetchConference = async () => {
      try {
        const res = await axios.get(`/api/conference/get-conference/${inviteConferenceId}`);
        setExpertiseOptions(res.data.expertise || []);
      } catch {
        toast.error("Could not load conference expertise options.");
      }
    };
    fetchConference();
  }, [inviteConferenceId, inviteRole]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        role: inviteRole || undefined,
        conferenceId: inviteConferenceId || undefined,
        conferenceName: inviteConferenceName || undefined,
        invitationToken: token || undefined,
      };
      const res = await axios.post("/api/auth/register", payload);
      if (res.data.success) {
        toast.success(res.data.message || "Account created successfully. You can now sign in.");
        navigate("/login");
      } else {
        toast.error(res.data.message || "Registration failed. Please try again.");
      }
    } catch (error) {
      const msg = error?.response?.data?.message;
      if (msg && !msg.toLowerCase().includes("server") && !msg.toLowerCase().includes("internal")) {
        toast.error(msg);
      } else {
        toast.error("Registration could not be completed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (name) => errors[name]?.message;

  const PasswordStrength = ({ password }) => {
    if (!password) return null;
    const checks = [
      { label: "8+ characters", pass: password.length >= 8 },
      { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
      { label: "Lowercase letter", pass: /[a-z]/.test(password) },
      { label: "Number", pass: /[0-9]/.test(password) },
    ];
    const passed = checks.filter(c => c.pass).length;
    const color = passed <= 1 ? "bg-destructive" : passed <= 2 ? "bg-yellow-500" : passed <= 3 ? "bg-blue-500" : "bg-green-500";
    return (
      <div className="space-y-1.5 mt-1.5">
        <div className="flex gap-1">
          {checks.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? color : "bg-muted"}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {checks.map((c, i) => (
            <span key={i} className={`text-[10px] font-medium ${c.pass ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {c.pass ? "✓" : "·"} {c.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  if (tokenLoading) {
    return (
      <Layout title="ConForum - Register">
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Skeleton className="h-10 w-56 mx-auto" />
              <Skeleton className="h-4 w-52 mx-auto mt-2" />
            </div>
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div className="space-y-5">
                  <div className="space-y-1.5"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full rounded-md" /></div>
                  <div className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
                  <div className="space-y-1.5"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
                    <div className="space-y-1.5"><Skeleton className="h-4 w-14" /><Skeleton className="h-10 w-full rounded-md" /></div>
                  </div>
                  <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full rounded-md" /><Skeleton className="h-3 w-64" /></div>
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-6">
                  <Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (token && !tokenValid) {
    return (
      <Layout title="ConForum - Invalid Link">
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
              <p className="text-muted-foreground text-sm">This invitation link is no longer valid. Please request a new one from the conference organizer.</p>
              <Button className="mt-6" onClick={() => navigate("/login")}>Go to Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="ConForum - Register">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {inviteRole ? `Register as ${inviteRole}` : "Create an account"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {inviteConferenceName
                ? `Joining: ${inviteConferenceName}`
                : "Start managing your research journey"}
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {inviteEmail && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-medium text-primary">
                    Invited as: <span className="font-bold">{inviteEmail}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    {...register("name", {
                      required: "Full name is required.",
                      minLength: { value: 2, message: "Name must be at least 2 characters." },
                    })}
                    className={fieldError("name") ? "border-destructive" : ""}
                  />
                  {fieldError("name") && <p className="text-destructive text-xs font-medium">{fieldError("name")}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    disabled={!!inviteEmail}   // LOCKED when invited
                    {...register("email", {
                      required: "Email address is required.",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address.",
                      },
                    })}
                    className={fieldError("email") ? "border-destructive" : ""}
                  />
                  {fieldError("email") && <p className="text-destructive text-xs font-medium">{fieldError("email")}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password", passwordRules)}
                      className={fieldError("password") ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldError("password")
                    ? <p className="text-destructive text-xs font-medium">{fieldError("password")}</p>
                    : <PasswordStrength password={passwordValue} />
                  }
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 234 567 890"
                      {...register("phone", {
                        required: "Phone number is required.",
                        pattern: {
                          value: /^\+?[\d\s\-()]{7,15}$/,
                          message: "Please enter a valid phone number.",
                        },
                      })}
                      className={fieldError("phone") ? "border-destructive" : ""}
                    />
                    {fieldError("phone") && <p className="text-destructive text-xs font-medium">{fieldError("phone")}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Location</Label>
                    <Input
                      id="address"
                      placeholder="City, Country"
                      {...register("address", { required: "Location is required." })}
                      className={fieldError("address") ? "border-destructive" : ""}
                    />
                    {fieldError("address") && <p className="text-destructive text-xs font-medium">{fieldError("address")}</p>}
                  </div>
                </div>

                {isReviewer && expertiseOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Areas of expertise</Label>
                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                      {expertiseOptions.map((exp, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer group">
                          <input
                            type="checkbox"
                            {...register("expertise")}
                            value={exp}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="group-hover:text-primary transition-colors">{exp}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="recovery_key">Secret recovery key</Label>
                  <Input
                    id="recovery_key"
                    placeholder="A memorable phrase for password reset"
                    {...register("recovery_key", {
                      required: "A secret recovery key is required.",
                      minLength: { value: 6, message: "Recovery key must be at least 6 characters." },
                    })}
                    className={fieldError("recovery_key") ? "border-destructive" : ""}
                  />
                  {fieldError("recovery_key")
                    ? <p className="text-destructive text-xs font-medium">{fieldError("recovery_key")}</p>
                    : <p className="text-xs text-muted-foreground">Used to recover your account if you forget your password.</p>
                  }
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating Account...</> : (
                    inviteRole === "reviewer" ? "Register as Reviewer" :
                    inviteRole === "organizer" ? "Register as Organizer" : "Create Account"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <button
                  onClick={() => navigate(token ? `/login?token=${token}` : "/login")}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in instead
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Register;