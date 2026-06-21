import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import axios from "axios";
import { useAuth } from "../../context/Auth";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const AllConferences = () => {
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auth] = useAuth();
  const navigate = useNavigate();

  const isAdmin = auth?.user?.role === 1;
  const isOrganizer = auth?.roles?.some((role) => role.role === "organizer");

  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const response = await axios.get("/api/conference/all-conferences");
        const data = response.data;
        setConferences(isAdmin ? data : data.filter((c) => c.status === "approved"));
      } catch (error) {
        console.error("Error fetching conferences:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConferences();
  }, [isAdmin]);

  return (
    <Layout title="PaperDesk - Conferences">
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {isAdmin ? "All Conferences" : "Conferences"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse and apply to the latest academic gatherings worldwide.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : conferences.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center">
                <p className="text-muted-foreground font-medium">No conferences found.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Conference</th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Deadlines</th>
                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {conferences.map((conference, index) => {
                      const now = new Date();
                      const submissionDeadline = new Date(conference.submission_deadline);
                      const isSubmissionClosed = submissionDeadline < now;

                      return (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold">{conference.conference_name}</div>
                            <div className="text-sm text-muted-foreground">{conference.acronym}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {conference.topics?.filter(t => t?.trim()).slice(0, 2).map((topic, i) => (
                                <Badge key={i} variant="teal" className="text-[10px]">{topic}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                            {conference.city}, {conference.country}
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Submission</div>
                            <div className={`text-sm font-semibold ${isSubmissionClosed ? "text-primary" : ""}`}>
                              {conference.submission_deadline?.slice(0, 10) || "-"}
                            </div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mt-1 mb-0.5">Starts</div>
                            <div className="text-sm">{conference.start_date?.slice(0, 10) || "-"}</div>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {isAdmin ? (
                              <Button size="sm" variant="outline" onClick={() => (window.location.href = "/admindashboard/update-conference")}>
                                Edit
                              </Button>
                            ) : isOrganizer ? (
                              <div className="flex flex-col items-center gap-1">
                                <Button size="sm" disabled>
                                  Apply Now
                                </Button>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  Editors cannot submit papers
                                </span>
                              </div>
                            ) : isSubmissionClosed ? (
                              <Button size="sm" variant="secondary" disabled>Closed</Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!auth?.user) return navigate("/login");
                                  navigate(`/conference/${conference.acronym}/submit-paper/${conference.id}`);
                                }}
                              >
                                Apply Now
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AllConferences;