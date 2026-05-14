import React, { useEffect, useState } from "react";
import axios from "axios";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Users, FileText } from "lucide-react";

const AssignmentsPage = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [groupedPapers, setGroupedPapers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conferenceId) return;

    const fetchAssignments = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `/api/organizer/assigned-papers/${conferenceId}`
        );
        //  Backend returns { success: true, data: { assignments: [...], papersWithAssignments: [...] } }
        const assignments = response.data?.data?.assignments || [];

        // Group by paper
        const grouped = {};
        assignments.forEach((a) => {
          const paperId = a.paper_id;
          if (!grouped[paperId]) {
            grouped[paperId] = {
              title: a.research_papers?.title || "No title",
              keywords: a.research_papers?.keywords || [],
              conferenceName: a.research_papers?.conference_name || "",
              reviewers: [],
            };
          }
          grouped[paperId].reviewers.push({
            name: a.users?.name || "Unknown",
            email: a.users?.email || "Unknown",
          });
        });

        setGroupedPapers(grouped);
        setError("");
      } catch (err) {
        console.error("Assignments fetch error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Failed to fetch assignments."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [conferenceId]);

  const paperCount = Object.keys(groupedPapers).length;

  return (
    <Layout title="ConForum - Paper Assignments">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b border-border">
                <h1 className="text-2xl font-bold text-foreground">Paper Assignments</h1>
                <p className="text-sm text-muted-foreground">
                  Conference:{" "}
                  <span className="font-medium">
                    {conferenceName || conferenceId || "—"}
                  </span>
                </p>
              </div>

              <div className="p-6">
                {loading && (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                )}

                {error && (
                  <div className="text-center text-red-600 dark:text-red-400 font-semibold p-4">
                    {error}
                  </div>
                )}

                {!loading && !error && paperCount === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p>No assignments found for this conference.</p>
                  </div>
                )}

                {!loading && !error && paperCount > 0 && (
                  <div className="space-y-4">
                    {Object.values(groupedPapers).map((paper, idx) => (
                      <Card key={idx} className="overflow-hidden border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1">
                              <h2 className="text-lg font-semibold text-foreground">
                                {paper.title}
                              </h2>
                              {paper.conferenceName && (
                                <p className="text-sm text-teal-600 dark:text-teal-400 mb-1">
                                  {paper.conferenceName}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                <strong>Keywords:</strong>{" "}
                                {paper.keywords?.length > 0
                                  ? paper.keywords.join(", ")
                                  : "No keywords"}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {paper.reviewers.length} reviewer
                              {paper.reviewers.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>

                          <div className="mt-4">
                            <h3 className="font-medium mb-2 text-foreground">
                              Assigned Reviewers:
                            </h3>
                            <div className="space-y-2">
                              {paper.reviewers.map((reviewer, i) => (
                                <div
                                  key={i}
                                  className="p-2 bg-muted/20 rounded border border-border"
                                >
                                  <p className="text-sm text-foreground">
                                    <strong>Name:</strong> {reviewer.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    <strong>Email:</strong> {reviewer.email}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AssignmentsPage;