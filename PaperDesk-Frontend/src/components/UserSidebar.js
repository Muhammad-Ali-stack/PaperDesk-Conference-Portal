import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, User, FileText, Star, Users,
  ChevronLeft, ChevronRight, Settings, Globe, PlusCircle
} from "lucide-react";
import OrganizerConferenceSelector from "./OrganizerConferenceSelector";

// ------------------------------------------------------------------
// NavItem
// ------------------------------------------------------------------
const NavItem = ({ to, icon: Icon, label, expanded }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group",
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )
    }
  >
    <Icon className={cn("h-4 w-4 flex-shrink-0", !expanded && "mx-auto")} />
    {expanded && <span className="truncate">{label}</span>}
  </NavLink>
);

// ------------------------------------------------------------------
// SectionLabel
// ------------------------------------------------------------------
const SectionLabel = ({ label, expanded }) =>
  expanded ? (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-3 mb-1 mt-4 first:mt-0">
      {label}
    </p>
  ) : (
    <div className="h-px bg-border mx-3 my-2" />
  );

// ------------------------------------------------------------------
// getInitialExpanded
// ------------------------------------------------------------------
const getInitialExpanded = () => {
  try {
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

// ------------------------------------------------------------------
// UserSidebar
// ------------------------------------------------------------------
const UserSidebar = () => {
  const [auth, , rolesLoaded] = useAuth();
  const [expanded, setExpanded] = useState(getInitialExpanded);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-expanded", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Returns true only after roles have loaded AND the user has the given role.
  const hasRole = (role) =>
    rolesLoaded && auth?.roles?.some((r) => r.role === role);

  // FIX: A co-author has role="author" in their roles array (injected by
  // the fixed getUserRolesController via email-based lookup) but with
  // isCoAuthor: true. hasRole("author") already catches both cases since
  // both have role: "author". No sidebar change needed beyond this comment.
  //
  // However, we expose isAuthor separately so we can show a "Co-author"
  // badge next to the section label when the user is ONLY a co-author
  // (i.e. has no explicit user_conference_roles author row of their own).
  const isAuthor = hasRole("author");
  const isOnlyCoAuthor =
    rolesLoaded &&
    auth?.roles?.some((r) => r.role === "author" && r.isCoAuthor === true) &&
    !auth?.roles?.some((r) => r.role === "author" && !r.isCoAuthor);

  const sidebarWidth = expanded ? "w-60" : "w-14";

  return (
    <>
      <div
        className={cn(
          "shrink-0 transition-[width] duration-300 ease-in-out",
          sidebarWidth
        )}
        aria-hidden="true"
      />

      <aside
        style={{ willChange: "width", contain: "layout style" }}
        className={cn(
          "fixed top-16 left-0 z-30 flex flex-col border-r bg-card",
          "transition-[width] duration-300 ease-in-out",
          "h-[calc(100vh-4rem)] overflow-visible",
          sidebarWidth
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-14 px-3 border-b shrink-0">
          {expanded && (
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Workspace
            </span>
          )}
          <button
            onClick={toggleExpanded}
            className={cn(
              "p-1.5 rounded-lg hover:bg-accent transition-colors duration-150 text-muted-foreground",
              !expanded && "mx-auto"
            )}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded
              ? <ChevronLeft className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">

          {/* General — always visible */}
          <SectionLabel label="General" expanded={expanded} />
          <NavItem to="/userdashboard/user-profile" icon={User}     label="Profile"        expanded={expanded} />
          <NavItem to="/userdashboard/roles"         icon={Settings} label="My Conferences" expanded={expanded} />

          {/* Organizer section */}
          {hasRole("organizer") && (
            <>
              <SectionLabel label="Editor" expanded={expanded} />
              <NavItem to="/userdashboard/create-conference"    icon={PlusCircle} label="Create Conference" expanded={expanded} />
              <NavItem to="/userdashboard/organizer-dashboard"  icon={Globe}      label="Overview"          expanded={expanded} />

              {expanded && (
                <div className="px-1 pb-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-2 mb-1.5">
                    Active Conference
                  </p>
                  <OrganizerConferenceSelector />
                </div>
              )}

              <NavItem to="/userdashboard/edit-conference"      icon={Settings}   label="Edit Conference"   expanded={expanded} />
              <NavItem to="/userdashboard/invite-reviewers"     icon={Users}      label="Invite Reviewers"  expanded={expanded} />
              <NavItem to="/userdashboard/accepted-invitations" icon={Users}      label="Accepted Invites"  expanded={expanded} />
              <NavItem to="/userdashboard/assign-papers"        icon={FileText}   label="Assign Papers"     expanded={expanded} />
              <NavItem to="/userdashboard/assignments"          icon={FileText}   label="Assignments"       expanded={expanded} />
              <NavItem to="/userdashboard/review-management"    icon={Star}       label="Review Management" expanded={expanded} />
              <NavItem to="/userdashboard/reviews"              icon={Star}       label="Check Reviews"     expanded={expanded} />
              <NavItem to="/userdashboard/papers/decisions"     icon={FileText}   label="Paper Decisions"   expanded={expanded} />
            </>
          )}

          {/* Reviewer section */}
          {hasRole("reviewer") && (
            <>
              <SectionLabel label="Reviewer" expanded={expanded} />
              <NavItem to="/userdashboard/reviewer-dashboard"  icon={Globe}    label="Overview"        expanded={expanded} />
              <NavItem to="/userdashboard/all-assigned-papers" icon={FileText} label="Assigned Papers" expanded={expanded} />
            </>
          )}

          {/*
            Author section — FIX: now visible for co-authors too.

            Previously: hasRole("author") was false for co-authors because
            they had no user_conference_roles row.

            Now: getUserRolesController synthesizes a virtual role entry
            { role: "author", isCoAuthor: true } via email lookup, so
            hasRole("author") returns true for co-authors as well.

            The section label shows "Author" for submitters and
            "Author (Co-author)" for users who are only co-authors,
            so the distinction is clear in the UI.
          */}
          {isAuthor && (
            <>
              {/* Section label with optional co-author indicator */}
              {expanded ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-3 mb-1 mt-4 flex items-center gap-1.5">
                  Author
                  {isOnlyCoAuthor && (
                    <span className="normal-case tracking-normal font-medium text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      Co-author
                    </span>
                  )}
                </p>
              ) : (
                <div className="h-px bg-border mx-3 my-2" />
              )}

              <NavItem to="/userdashboard/author-dashboard" icon={Globe}    label="Overview"  expanded={expanded} />
              <NavItem to="/userdashboard/papers"           icon={FileText} label="My Papers" expanded={expanded} />
            </>
          )}

        </nav>

        {expanded && (
          <div className="p-3 border-t shrink-0">
            <p className="text-[10px] font-bold text-center text-muted-foreground/50 uppercase tracking-widest">
              PaperDesk v1.2
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

export default UserSidebar;