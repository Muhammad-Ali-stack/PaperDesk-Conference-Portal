import React, { useState } from "react";
import Layout from "../../components/Layout";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";

const passwordRules = {
  required: "Password is required.",
  minLength: { value: 8, message: "Password must be at least 8 characters." },
  validate: {
    hasUppercase: (v) =>
      /[A-Z]/.test(v) || "Password must contain at least one uppercase letter.",
    hasLowercase: (v) =>
      /[a-z]/.test(v) || "Password must contain at least one lowercase letter.",
    hasNumber: (v) => /[0-9]/.test(v) || "Password must contain at least one number.",
  },
};

const Forgotpassword = () => {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get("email");

  const [email, setEmail] = useState(emailFromQuery || "");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);

  const navigate = useNavigate();

  const validatePassword = (password) => {
    if (!password) return passwordRules.required;
    if (password.length < passwordRules.minLength.value)
      return passwordRules.minLength.message;
    const uppercaseCheck = passwordRules.validate.hasUppercase(password);
    if (uppercaseCheck !== true) return uppercaseCheck;
    const lowercaseCheck = passwordRules.validate.hasLowercase(password);
    if (lowercaseCheck !== true) return lowercaseCheck;
    const numberCheck = passwordRules.validate.hasNumber(password);
    if (numberCheck !== true) return numberCheck;
    return null;
  };

  const handlePasswordChange = (e) => {
    const newValue = e.target.value;
    setNewPassword(newValue);
    if (passwordTouched) {
      setPasswordError(validatePassword(newValue));
    }
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(newPassword));
  };

  const PasswordStrength = ({ password }) => {
    if (!password) return null;
    const checks = [
      { label: "8+ characters", pass: password.length >= 8 },
      { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
      { label: "Lowercase letter", pass: /[a-z]/.test(password) },
      { label: "Number", pass: /[0-9]/.test(password) },
    ];
    const passed = checks.filter((c) => c.pass).length;
    const color =
      passed <= 1
        ? "bg-destructive"
        : passed <= 2
        ? "bg-yellow-500"
        : passed <= 3
        ? "bg-blue-500"
        : "bg-green-500";
    return (
      <div className="space-y-1.5 mt-1.5">
        <div className="flex gap-1">
          {checks.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < passed ? color : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {checks.map((c, i) => (
            <span
              key={i}
              className={`text-[10px] font-medium ${
                c.pass
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              }`}
            >
              {c.pass ? "✓" : "·"} {c.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedRecoveryKey = recoveryKey.trim();

    if (!trimmedEmail) {
      toast.error("Email is required.");
      return;
    }
    if (!trimmedRecoveryKey) {
      toast.error("Recovery key is required.");
      return;
    }

    setPasswordTouched(true);
    const finalError = validatePassword(newPassword);
    setPasswordError(finalError);

    if (finalError) {
      toast.error(finalError);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "/api/auth/forgot-password",
        {
          email: trimmedEmail,
          recovery_key: trimmedRecoveryKey, 
          newPassword: newPassword,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      if (response.data.success) {
        toast.success("Password reset successfully! Please login.");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        toast.error(response.data.message || "Failed to reset password.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      let message = "Failed to reset password. Please try again.";
      if (error.response) {
        if (error.response.status === 404) {
          message = error.response.data.message || "Wrong email or recovery key.";
        } else if (error.response.status === 400) {
          message = error.response.data.message || "Invalid input provided.";
        } else if (error.response.data?.message) {
          message = error.response.data.message;
        }
      } else if (error.request) {
        message = "Cannot connect to server. Check your connection.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="ConForum - Reset Password">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Reset Password</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Enter your email, recovery key, and new password
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={!!emailFromQuery}
                  />
                  {emailFromQuery && (
                    <p className="text-xs text-muted-foreground">
                      This email is pre‑filled from your invitation link.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recoveryKey">Secret Recovery Key</Label>
                  <Input
                    id="recoveryKey"
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="Your memorable recovery phrase"
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the recovery key you set during registration
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      className={passwordError && passwordTouched ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && passwordTouched ? (
                    <p className="text-destructive text-xs font-medium">{passwordError}</p>
                  ) : (
                    <PasswordStrength password={newPassword} />
                  )}
                </div>

                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  Back to Sign In
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Forgotpassword;