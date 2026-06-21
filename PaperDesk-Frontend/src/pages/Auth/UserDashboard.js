import React from "react";
import { NavLink } from "react-router-dom";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";
import { Card, CardContent } from "../../components/ui/card";
import { FileText, Star, Globe, LayoutDashboard } from "lucide-react";

const ROLE_CONFIG = {
  organizer: {
    label: "Editor (Organizer)",
    desc: "Manage conferences, invite reviewers, handle paper assignments and final decisions.",
    icon: Globe,
    color: "bg-teal-500",
    link: "/userdashboard/organizer-dashboard",
    accent: "border-teal-500/20 hover:border-teal-500/40",
  },
  2: {
    label: "Editor (Organizer)",
    desc: "Manage conferences, invite reviewers, handle paper assignments and final decisions.",
    icon: Globe,
    color: "bg-teal-500",
    link: "/userdashboard/organizer-dashboard",
    accent: "border-teal-500/20 hover:border-teal-500/40",
  },
  reviewer: {
    label: "Reviewer",
    desc: "Evaluate assigned manuscripts, submit expert reviews, and shape the quality of published research.",
    icon: Star,
    color: "bg-indigo-500",
    link: "/userdashboard/reviewer-dashboard",
    accent: "border-indigo-500/20 hover:border-indigo-500/40",
  },
  3: {
    label: "Reviewer",
    desc: "Evaluate assigned manuscripts, submit expert reviews, and shape the quality of published research.",
    icon: Star,
    color: "bg-indigo-500",
    link: "/userdashboard/reviewer-dashboard",
    accent: "border-indigo-500/20 hover:border-indigo-500/40",
  },
  author: {
    label: "Author",
    desc: "Submit research papers, respond to reviewer feedback, and track the status of your publications.",
    icon: FileText,
    color: "bg-emerald-500",
    link: "/userdashboard/author-dashboard",
    accent: "border-emerald-500/20 hover:border-emerald-500/40",
  },
  4: {
    label: "Author",
    desc: "Submit research papers, respond to reviewer feedback, and track the status of your publications.",
    icon: FileText,
    color: "bg-emerald-500",
    link: "/userdashboard/author-dashboard",
    accent: "border-emerald-500/20 hover:border-emerald-500/40",
  },
};

const UserDashboard = () => {
  const [auth] = useAuth();
  const roles = auth?.roles ?? [];

  // Deduplicate roles by their key (string or number)
  const seen = new Set();
  const uniqueRoles = roles.filter(r => {
    const cfg = ROLE_CONFIG[r.role];
    if (!cfg) return false;
    if (seen.has(cfg.link)) return false;
    seen.add(cfg.link);
    return true;
  });

  return (
    <Layout title="PaperDesk - Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-7">

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[200px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
              alt="Personal workspace dashboard"
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-12 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-4 backdrop-blur-sm border border-white/20">
                Welcome Back
              </span>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
                Personal <span className="text-teal-300">Workspace</span>
              </h1>
              <p className="text-sm lg:text-base text-white/70 font-medium leading-relaxed">
                {auth?.user?.name ? `Hello, ${auth.user.name}! ` : ""}
                Manage your submissions, assignments, and collaborate with the global research community.
              </p>
            </div>
          </div>

          {/* Active Role Cards */}
          {uniqueRoles.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-4">
                Your Active Roles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueRoles.map((r, idx) => {
                  const cfg = ROLE_CONFIG[r.role];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <NavLink key={idx} to={cfg.link}>
                      <Card className={`hover:shadow-md transition-all duration-200 cursor-pointer h-full border ${cfg.accent}`}>
                        <CardContent className="p-5 flex flex-col gap-3">
                          <div className={`inline-flex p-2.5 rounded-xl ${cfg.color} w-fit`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-sm mb-1">{cfg.label}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{cfg.desc}</p>
                          </div>
                          <p className="text-xs text-primary font-semibold mt-auto">
                            Go to Overview →
                          </p>
                        </CardContent>
                      </Card>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-10 text-center">
                <LayoutDashboard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  No roles yet. Submit a paper to become an Author, or join a conference as a Reviewer via an invitation link.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
