import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { useAuth } from "../context/Auth";
import toast from "react-hot-toast";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Loader2, User, Eye, EyeOff } from "lucide-react";

// Password strength checker (identical to Register component)
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

const UserProfile = () => {
  const [auth, setAuth] = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (auth?.user) {
      const { email: e, name: n, phone: p, address: a } = auth.user;
      setName(n || "");
      setPhone(p || "");
      setEmail(e || "");
      setAddress(a || "");
    }
  }, [auth?.user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.put("/api/auth/profile", { name, email, password, phone, address });
      if (data?.error) {
        toast.error(data.error);
      } else {
        setAuth({ ...auth, user: data?.updatedUser });
        const ls = JSON.parse(localStorage.getItem("auth"));
        ls.user = data.updatedUser;
        localStorage.setItem("auth", JSON.stringify(ls));
        toast.success("Profile updated successfully");
        setPassword(""); // clear password field after successful update
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="ConForum - Profile">
      <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Your Profile</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Update your personal information</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">{name || "Your Name"}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm break-all">{email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm sm:text-base">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm sm:text-base">Email (Locked)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="opacity-60 cursor-not-allowed text-sm sm:text-base"
                    />
                  </div>

                  {/* Password field with security UI (strength meter + toggle) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm sm:text-base">New Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="text-sm sm:text-base pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Show strength meter only if user is typing a new password */}
                    {password && <PasswordStrength password={password} />}
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank to keep your current password.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm sm:text-base">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (234) 567-890"
                      required
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="address" className="text-sm sm:text-base">Mailing Address</Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your address"
                      rows={3}
                      required
                      className="text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving} size="default" className="w-full sm:w-auto">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;