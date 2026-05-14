import { Outlet, useParams, NavLink } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/Auth";
import Layout from "./Layout";
import LoadingSpinner from "./LoadingSpinner";
import { cn } from "../lib/utils";

const ConferenceLayout = () => {
  const { id } = useParams();
  const [conference, setConference] = useState(null);
  const [auth] = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchConferenceDetails = useCallback(async () => {
    try {
      const response = await axios.get(`/api/conference/get-conference/${id}`);
      setConference(response.data);
    } catch (error) {
      console.error("Error fetching conference details:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchConferenceDetails();
  }, [id, fetchConferenceDetails]);

  if (loading) {
    return (
      <Layout title="ConForum - Conference Details">
        <LoadingSpinner fullPage />
      </Layout>
    );
  }

  if (!conference) {
    return (
      <Layout title="ConForum - Not Found">
        <div className="text-center py-20 text-muted-foreground">Conference not found.</div>
      </Layout>
    );
  }

  const isOrganizer = auth?.roles?.some(
    (r) => r.role === "organizer" && (r.conferenceId === id || r.conferenceId === null)
  );
  const isAuthor = auth?.roles?.some((r) => r.role === "author" && r.conferenceId === id);

  const organizerTabs = [
    { name: "Invite Reviewers", path: "invite-reviewers" },
    { name: "Accepted Invitations", path: "accepted-invitations" },
    { name: "Assign Papers", path: "assign-papers" },
    { name: "Paper Assignments", path: "assignments" },
    { name: "Review Management", path: "review-management" },
    { name: "Decisions", path: "papers/decisions" },
  ];
  const authorTabs = [{ name: "Submitted Papers", path: "papers" }];
  const tabs = isOrganizer ? organizerTabs : isAuthor ? authorTabs : [];

  return (
    <Layout title={`ConForum - ${conference.conference_name || "Conference"}`}>
      <div className="bg-background">
        {tabs.length > 0 && (
          <div className="border-b bg-card sticky top-16 z-30">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
              <nav className="flex overflow-x-auto no-scrollbar gap-1 py-1">
                {tabs.map((tab) => (
                  <NavLink
                    key={tab.path}
                    to={`/conference/${id}/${tab.path}`}
                    className={({ isActive }) =>
                      cn(
                        "whitespace-nowrap px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 flex-shrink-0",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )
                    }
                  >
                    {tab.name}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </div>
      </div>
    </Layout>
  );
};

export default ConferenceLayout;
