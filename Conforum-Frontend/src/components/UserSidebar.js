import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, User, FileText, Star, Users,
  ChevronLeft, ChevronRight, Settings, Globe
} from "lucide-react";
import OrganizerConferenceSelector from "./OrganizerConferenceSelector";

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------
const NavItem = ({ to, icon: Icon, label, expanded }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )
    }
  >
    <Icon
      className={cn(
        "h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
        !expanded && "mx-auto"
      )}
    />
    {expanded && <span className="truncate">{label}</span>}
  </NavLink>
);

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------
const SectionLabel = ({ label, expanded }) =>
  expanded ? (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-3 mb-1 mt-4 first:mt-0">
      {label}
    </p>
  ) : (
    <div className="h-px bg-border mx-3 my-2" />
  );

// ---------------------------------------------------------------------------
// getInitialExpanded
// Reads the last saved sidebar state from localStorage.
// Defaults to expanded (true) if nothing is stored.
// ---------------------------------------------------------------------------
const getInitialExpanded = () => {
  try {
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

// ---------------------------------------------------------------------------
// UserSidebar
// ---------------------------------------------------------------------------
const UserSidebar = () => {
  // fetchRoles is pulled from the auth context so we reuse the same
  // function that updates auth state AND localStorage in one place.
  const [auth, , rolesLoaded, fetchRoles] = useAuth();
  const [expanded, setExpanded] = useState(getInitialExpanded);

  // ---------------------------------------------------------------------------
  // Listen for the "roles-updated" custom event.
  // Any part of the app can trigger a sidebar refresh by dispatching:
  //   window.dispatchEvent(new CustomEvent("roles-updated"))
  //
  // When the event fires, we call fetchRoles from the auth context directly.
  // This ensures auth state and localStorage are both updated, so the
  // sidebar re-renders without requiring a logout/login cycle.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleRolesUpdated = () => {
      if (auth?.user?._id) {
        // Use the context's own fetchRoles so state + localStorage stay in sync.
        fetchRoles(auth.user._id);
      }
    };

    window.addEventListener("roles-updated", handleRolesUpdated);
    return () => window.removeEventListener("roles-updated", handleRolesUpdated);
  }, [auth?.user?._id, fetchRoles]);

  // ---------------------------------------------------------------------------
  // Toggle sidebar width and persist the preference to localStorage.
  // ---------------------------------------------------------------------------
  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-expanded", JSON.stringify(next));
      } catch {
        // Silently ignore if localStorage is unavailable.
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Role helper.
  // Guards against rendering role-specific sections before roles have loaded,
  // which would cause a flash of missing content on page refresh.
  // ---------------------------------------------------------------------------
  const hasRole = (role) =>
    rolesLoaded && auth?.roles?.some((r) => r.role === role);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
        "h-[calc(100vh-4rem)] sticky top-16 overflow-hidden",
        expanded ? "w-60 shrink-0" : "w-14 shrink-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b shrink-0">
        {expanded && (
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Workspace
          </span>
        )}
        <button
          onClick={toggleExpanded}
          className={cn(
            "p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground",
            !expanded && "mx-auto"
          )}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">

        {/* General -- always visible to all logged-in users */}
        <SectionLabel label="General" expanded={expanded} />
        <NavItem to="/userdashboard/user-dashboard" icon={LayoutDashboard} label="Dashboard"      expanded={expanded} />
        <NavItem to="/userdashboard/user-profile"   icon={User}            label="Profile"        expanded={expanded} />
        <NavItem to="/userdashboard/roles"          icon={Settings}        label="My Conferences" expanded={expanded} />

        {/* Organizer -- only shown when user has the organizer role */}
        {hasRole("organizer") && (
          <>
            <SectionLabel label="Editor" expanded={expanded} />
            {expanded && (
              <div className="px-1 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-2 mb-1.5">
                  Active Conference
                </p>
                <OrganizerConferenceSelector />
              </div>
            )}
            <NavItem to="/userdashboard/organizer-dashboard"  icon={Globe}    label="Overview"          expanded={expanded} />
            <NavItem to="/userdashboard/invite-reviewers"     icon={Users}    label="Invite Reviewers"  expanded={expanded} />
            <NavItem to="/userdashboard/accepted-invitations" icon={Users}    label="Accepted Invites"  expanded={expanded} />
            <NavItem to="/userdashboard/assign-papers"        icon={FileText} label="Assign Papers"     expanded={expanded} />
            <NavItem to="/userdashboard/assignments"          icon={FileText} label="Assignments"       expanded={expanded} />
            <NavItem to="/userdashboard/review-management"    icon={Star}     label="Review Management" expanded={expanded} />
            <NavItem to="/userdashboard/reviews"              icon={Star}     label="Check Reviews"     expanded={expanded} />
            <NavItem to="/userdashboard/papers/decisions"     icon={FileText} label="Paper Decisions"   expanded={expanded} />
          </>
        )}

        {/* Reviewer -- only shown when user has the reviewer role */}
        {hasRole("reviewer") && (
          <>
            <SectionLabel label="Reviewer" expanded={expanded} />
            <NavItem to="/userdashboard/reviewer-dashboard"  icon={Globe}    label="Overview"        expanded={expanded} />
            <NavItem to="/userdashboard/all-assigned-papers" icon={FileText} label="Assigned Papers" expanded={expanded} />
          </>
        )}

        {/* Author -- only shown when user has the author role.
            This section appears automatically after a paper is submitted
            because submitForm dispatches "roles-updated" which calls
            fetchRoles and updates auth state without a re-login. */}
        {hasRole("author") && (
          <>
            <SectionLabel label="Author" expanded={expanded} />
            <NavItem to="/userdashboard/author-dashboard" icon={Globe}    label="Overview"  expanded={expanded} />
            <NavItem to="/userdashboard/papers"           icon={FileText} label="My Papers" expanded={expanded} />
          </>
        )}

      </nav>

      {/* Footer */}
      {expanded && (
        <div className="p-3 border-t shrink-0">
          <p className="text-[10px] font-bold text-center text-muted-foreground/50 uppercase tracking-widest">
            ConForum v1.1
          </p>
        </div>
      )}
    </aside>
  );
};

export default UserSidebar;