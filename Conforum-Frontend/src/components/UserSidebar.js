import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, User, FileText, Star, Users,
  ChevronLeft, ChevronRight, Settings, Globe
} from "lucide-react";
import OrganizerConferenceSelector from "./OrganizerConferenceSelector";

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
    <Icon
      className={cn(
        "h-4 w-4 flex-shrink-0",
        !expanded && "mx-auto"
      )}
    />
    {expanded && <span className="truncate">{label}</span>}
  </NavLink>
);

const SectionLabel = ({ label, expanded }) =>
  expanded ? (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 px-3 mb-1 mt-4 first:mt-0">
      {label}
    </p>
  ) : (
    <div className="h-px bg-border mx-3 my-2" />
  );

const getInitialExpanded = () => {
  try {
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

const UserSidebar = () => {
  const [auth, , rolesLoaded, fetchRoles] = useAuth();
  const [expanded, setExpanded] = useState(getInitialExpanded);
  const pollingIntervalRef = useRef(null);
  const lastFetchTimeRef = useRef(0);

  // Fetch roles with debouncing to avoid too many requests
  const refetchRoles = (force = false) => {
    if (!auth?.user?._id) return;
    
    const now = Date.now();
    // Only refetch if 5+ seconds have passed since last fetch (or force is true)
    if (force || now - lastFetchTimeRef.current > 5000) {
      fetchRoles(auth.user._id);
      lastFetchTimeRef.current = now;
    }
  };

  // 1. Fetch roles when component mounts or when auth changes
  useEffect(() => {
    refetchRoles(true);
  }, [auth?.user?._id]);

  // 2. Refetch roles when page becomes visible (user tabs back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetchRoles(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [auth?.user?._id, fetchRoles]);

  // 3. Refetch roles when window comes into focus
  useEffect(() => {
    const handleFocus = () => {
      refetchRoles(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [auth?.user?._id, fetchRoles]);

  // 4. Optional: Poll roles every 30 seconds for real-time updates
  useEffect(() => {
    pollingIntervalRef.current = setInterval(() => {
      refetchRoles();
    }, 30000); // 30 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [auth?.user?._id, fetchRoles]);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-expanded", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const hasRole = (role) =>
    rolesLoaded && auth?.roles?.some((r) => r.role === role);

  const sidebarWidth = expanded ? "w-60" : "w-14";

  return (
    <>
      {/*
        Spacer div — takes up the same width as the fixed sidebar so the
        content in DashboardLayout is pushed right by the correct amount.
        Fixed elements are out of normal flow so without this spacer the
        main content would slide under the sidebar.
      */}
      <div
        className={cn(
          "shrink-0 transition-[width] duration-300 ease-in-out",
          sidebarWidth
        )}
        aria-hidden="true"
      />

      {/*
        Fixed sidebar — always in the same spot, completely unaffected by
        page content height, scroll position, or layout reflows.
        top-16 matches the header height (4rem / 64px).
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

        {/* Navigation — only this inner element scrolls, not the sidebar itself */}
        <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">

          <SectionLabel label="General" expanded={expanded} />
          <NavItem to="/userdashboard/user-dashboard" icon={LayoutDashboard} label="Dashboard"      expanded={expanded} />
          <NavItem to="/userdashboard/user-profile"   icon={User}            label="Profile"        expanded={expanded} />
          <NavItem to="/userdashboard/roles"          icon={Settings}        label="My Conferences" expanded={expanded} />

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
              <NavItem to="/userdashboard/edit-conference"      icon={Settings} label="Edit Conference"   expanded={expanded} />
            </>
          )}

          {hasRole("reviewer") && (
            <>
              <SectionLabel label="Reviewer" expanded={expanded} />
              <NavItem to="/userdashboard/reviewer-dashboard"  icon={Globe}    label="Overview"        expanded={expanded} />
              <NavItem to="/userdashboard/all-assigned-papers" icon={FileText} label="Assigned Papers" expanded={expanded} />
            </>
          )}

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
              PaperDesk v1.2
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

export default UserSidebar;