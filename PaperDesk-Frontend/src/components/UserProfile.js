import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { useAuth } from "../context/Auth";
import toast from "react-hot-toast";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Loader2, User } from "lucide-react";

const UserProfile = () => {
  const [auth, setAuth] = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

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
      const { data } = await axios.put("/api/auth/profile", { name, address });
      if (data?.error) {
        toast.error(data.error);
      } else {
        setAuth({ ...auth, user: data?.data?.user });
        const ls = JSON.parse(localStorage.getItem("auth"));
        ls.user = data.data.user;
        localStorage.setItem("auth", JSON.stringify(ls));
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="PaperDesk - Profile">
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

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm sm:text-base">Phone Number (Locked)</Label>
                    <Input
                      id="phone"
                      value={phone}
                      disabled
                      className="opacity-60 cursor-not-allowed text-sm sm:text-base"
                    />
                  </div>

                  
                  <div className="space-y-1.5">
  <Label htmlFor="address" className="text-sm sm:text-base">Address (Locked)</Label>
  <Input
    id="address"
    value={address}
    disabled
    className="opacity-60 cursor-not-allowed text-sm sm:text-base"
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