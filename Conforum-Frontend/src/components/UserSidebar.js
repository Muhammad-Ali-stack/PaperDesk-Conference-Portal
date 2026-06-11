import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, User, FileText, Star, Users,
  ChevronLeft, ChevronRight, Settings, Globe
} from "lucide-react";
import OrganizerConferenceSelector from "./OrganizerConferenceSelector";

// ------------------------------------------------------------------
// NavItem
// A single sidebar link. Renders icon + label when expanded,
// icon only (centered) when collapsed.
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
// Shows a text heading when expanded, a thin divider when collapsed.
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
// Reads the sidebar's last known state from localStorage.
// Defaults to expanded (true) if nothing is saved.
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
// Fixed left sidebar. Reads roles directly from AuthContext.
// Role sections (Organizer, Reviewer, Author) are shown or hidden
// based on what the context currently holds -- no event listeners
// needed because AuthContext is the single source of truth.
// ------------------------------------------------------------------
const UserSidebar = () => {
  // rolesLoaded: true once the initial fetchRoles call has resolved,
  // prevents flickering where all role sections briefly appear.
  const [auth, , rolesLoaded] = useAuth();
  const [expanded, setExpanded] = useState(getInitialExpanded);

  // Persist the expanded/collapsed preference across page reloads.
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
  // Guards against the sidebar flickering role sections before the first
  // fetchRoles response arrives.
  const hasRole = (role) =>
    rolesLoaded && auth?.roles?.some((r) => r.role === role);

  const sidebarWidth = expanded ? "w-60" : "w-14";

  return (
    <>
      {/*
        Spacer div -- occupies the same width as the fixed sidebar so that
        the main content area is pushed to the right by the correct amount.
        Fixed elements are removed from normal flow, so without this the
        page content would scroll underneath the sidebar.
      */}
      <div
        className={cn(
          "shrink-0 transition-[width] duration-300 ease-in-out",
          sidebarWidth
        )}
        aria-hidden="true"
      />

      {/*
        Fixed sidebar -- always anchored to the top-left of the viewport,
        unaffected by page scroll or layout reflows.
        top-16 = 4rem, matching the header height.
      */}
      <aside
        style={{ willChange: "width", contain: "layout style" }}
        className={cn(
          "fixed top-16 left-0 z-30 flex flex-col border-r bg-card",
          "transition-[width] duration-300 ease-in-out",
          "h-[calc(100vh-4rem)] overflow-visible",
          sidebarWidth
        )}
      >
        {/* Sidebar header -- shows "Workspace" label and collapse toggle */}
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

        {/*
          Scrollable nav area -- only this inner element scrolls,
          keeping the header and footer always visible.
        */}
        <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">

          {/* General section -- always visible to every logged-in user */}
          <SectionLabel label="General" expanded={expanded} />
          <NavItem to="/userdashboard/user-dashboard" icon={LayoutDashboard} label="Dashboard"      expanded={expanded} />
          <NavItem to="/userdashboard/user-profile"   icon={User}            label="Profile"        expanded={expanded} />
          <NavItem to="/userdashboard/roles"          icon={Settings}        label="My Conferences" expanded={expanded} />

          {/*
            Organizer section -- rendered only when the user holds the
            "organizer" role on at least one conference.
            fetchRoles is called in AuthorForm after paper submission,
            so this section appears/disappears without a re-login.
          */}
          {hasRole("organizer") && (
            <>
              <SectionLabel label="Editor" expanded={expanded} />

              {/* Conference selector only makes sense when the sidebar is expanded */}
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
              <NavItem to="/userdashboard/edit-conference"      icon={Settings} label="Edit Conference"   expanded={expanded} />
            </>
          )}

          {/*
            Reviewer section -- rendered only when the user holds the
            "reviewer" role. Assigned by an organizer via invite flow,
            not by any action in this component.
          */}
          {hasRole("reviewer") && (
            <>
              <SectionLabel label="Reviewer" expanded={expanded} />
              <NavItem to="/userdashboard/reviewer-dashboard"  icon={Globe}    label="Overview"        expanded={expanded} />
              <NavItem to="/userdashboard/all-assigned-papers" icon={FileText} label="Assigned Papers" expanded={expanded} />
            </>
          )}

          {/*
            Author section -- rendered only when the user holds the
            "author" role. The backend assigns this role on first paper
            submission. AuthorForm calls fetchRoles after a successful
            submit so this section appears immediately without re-login.
          */}
          {hasRole("author") && (
            <>
              <SectionLabel label="Author" expanded={expanded} />
              <NavItem to="/userdashboard/author-dashboard" icon={Globe}    label="Overview"  expanded={expanded} />
              <NavItem to="/userdashboard/papers"           icon={FileText} label="My Papers" expanded={expanded} />
            </>
          )}

        </nav>

        {/* Sidebar footer -- version stamp, only shown when expanded */}
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