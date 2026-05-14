import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { ChevronDown, ChevronUp, FileText, RefreshCw, ShieldCheck } from "lucide-react";

const ReviewManagement = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const navigate = useNavigate();

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviewer, setExpandedReviewer] = useState(null);
  const [submissionStatuses, setSubmissionStatuses] = useState({});
  const [activeTab, setActiveTab] = useState("reviewers");

  useEffect(() => {
    if (conferenceId) {
      fetchData();
    }
  }, [conferenceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/organizer/review-management/${conferenceId}`);
      const data = response.data?.data ?? response.data;
      let papers = Array.isArray(data) ? data : [];

      papers = [...papers].sort((a, b) => {
        const getDate = (paper) =>
          paper.assignedAt ||
          paper.latest_assigned_at ||
          paper.assigned_at ||
          paper.created_at ||
          paper.submittedDate ||
          null;
        const dateA = getDate(a);
        const dateB = getDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB) - new Date(dateA);
      });

      setTableData(papers);
      papers.forEach((paper) => fetchSubmissionStatus(paper.paperId));
    } catch (error) {
      console.error("Error fetching review data:", error);
      toast.error("Failed to load review data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionStatus = async (paperId) => {
    if (!paperId) return;
    try {
      const res = await axios.get(
        `/api/conference/${conferenceId}/papers/${paperId}/submission-status`
      );
      const status = res.data?.data ?? res.data;
      setSubmissionStatuses((prev) => ({ ...prev, [paperId]: status }));
    } catch (error) {
      console.error("Error fetching submission status:", error);
    }
  };

  const handleViewFullReviews = useCallback(
    (paperId, paperTitle, event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!paperId) {
        toast.error("Cannot view reviews: Paper ID is missing");
        return;
      }
      const url = `/userdashboard/reviews?paperId=${encodeURIComponent(
        paperId
      )}&conferenceId=${encodeURIComponent(conferenceId)}`;
      navigate(url);
    },
    [conferenceId, navigate]
  );

  const handleDecision = async (paperId, decision) => {
    try {
      const response = await axios.post("/api/organizer/update-decision", { paperId, decision });
      if (response.data.success) {
        toast.success("Decision updated successfully.");
        setTableData((prev) =>
          prev.map((paper) => (paper.paperId === paperId ? { ...paper, decision } : paper))
        );
      } else {
        toast.error(response.data.message || "Failed to update the decision.");
        await fetchData();
      }
    } catch (error) {
      console.error("Error updating decision:", error);
      toast.error("Failed to update the decision. Please try again.");
      await fetchData();
    }
  };

  const toggleReviewer = (key) => {
    setExpandedReviewer((prev) => (prev === key ? null : key));
  };

  const getStatusBadge = (status) => {
    if (status === "reviewed") return <Badge variant="success">Reviewed</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  const getRecommendationBadge = (rec) => {
    if (!rec || rec === "-") return <span className="text-muted-foreground text-xs">—</span>;
    if (rec === "Accept") return <Badge variant="success">{rec}</Badge>;
    if (rec === "Accept with minor correction") return <Badge variant="info">{rec}</Badge>;
    if (rec === "Reject") return <Badge variant="destructive">{rec}</Badge>;
    return <Badge variant="outline">{rec}</Badge>;
  };

  const getDecisionBadge = (decision) => {
    if (decision === "Accepted") return <Badge variant="success">Accepted</Badge>;
    if (decision === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (decision === "Modification Required")
      return <Badge variant="warning">Modification Required</Badge>;
    if (decision === "Assigned") return <Badge variant="purple">Assigned</Badge>;
    return null;
  };

  const getDecisionTextColor = (decision) => {
    if (decision === "Accepted") return "text-green-300";
    if (decision === "Rejected") return "text-red-300";
    if (decision === "Modification Required") return "text-yellow-200";
    if (decision === "Assigned") return "text-purple-300";
    return "text-white/80";
  };

  const getPlagiarismColor = (score) => {
    if (score === null || score === undefined) return "text-muted-foreground";
    if (score <= 15) return "text-green-600 dark:text-green-400";
    if (score <= 25) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const TableRowSkeleton = () => (
    <Card className="overflow-hidden">
      <div className="bg-muted h-12 px-5 flex items-center gap-3">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-64" />
      </div>
      <CardContent className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Tab filters
  // ---------------------------------------------------------------------------
  const reviewerReviewedPapers = tableData.filter(
    (paper) => paper.reviewers && paper.reviewers.some((r) => r.status === "reviewed")
  );

  const organizerReviewedPapers = tableData.filter(
    (paper) =>
      paper.decision &&
      paper.decision !== "pending" &&
      (!paper.reviewers || paper.reviewers.length === 0)
  );

  const unreviewedPapers = tableData.filter((paper) => {
    const noDecision = !paper.decision || paper.decision === "pending";
    const noReviewerReviewed =
      !paper.reviewers ||
      paper.reviewers.length === 0 ||
      !paper.reviewers.some((r) => r.status === "reviewed");
    const notOrganizerReviewed = !(
      paper.decision &&
      paper.decision !== "pending" &&
      (!paper.reviewers || paper.reviewers.length === 0)
    );
    return noDecision && noReviewerReviewed && notOrganizerReviewed;
  });

  // ---------------------------------------------------------------------------
  // Paper card renderer
  // ---------------------------------------------------------------------------
  const renderPapersList = (papersList) => {
    if (papersList.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No papers in this category.
          </CardContent>
        </Card>
      );
    }

    return papersList.map((paper, index) => {
      const currentPaperId = paper.paperId;
      const currentPaperTitle = paper.title;
      const status = submissionStatuses[currentPaperId];

      // True when organizer gave the decision directly with no reviewers assigned
      const wasReviewedByOrganizer =
        paper.decision &&
        paper.decision !== "pending" &&
        (!paper.reviewers || paper.reviewers.length === 0);

      const organizerComments =
        paper.organizerCommentsForAuthors ??
        paper.organizer_comments_for_authors ??
        paper.commentsForAuthors ??
        paper.comments_for_authors ??
        null;

      const plagiarismScore = paper.plagiarismScore ?? null;

      return (
        <Card key={currentPaperId} className="overflow-hidden">
          {/* ----------------------------------------------------------------
              Card header
          ---------------------------------------------------------------- */}
          <div className="bg-teal-700 dark:bg-teal-900 text-white px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm opacity-70">#{index + 1}</span>
              <span className="font-semibold text-base">{paper.title}</span>
              {paper.status === "resubmitted" && (
                <Badge variant="warning" className="bg-orange-500 text-white">
                  Resubmitted
                </Badge>
              )}
              {wasReviewedByOrganizer && (
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  Reviewed by Editor
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {status && (
                <span className="flex items-center gap-1 opacity-80 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  {status.currentCount} / {status.unlimited ? "∞" : status.maxResubmissions}{" "}
                  resubmissions
                </span>
              )}
              <span className="opacity-80">
                Overall: <span className="font-semibold">{paper.overallstatus}</span>
              </span>
              <span className={`font-semibold ${getDecisionTextColor(paper.decision)}`}>
                {paper.decision || "Pending"}
              </span>
            </div>
          </div>

          <CardContent className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* --------------------------------------------------------------
                Column 1 — Authors + Scores
            -------------------------------------------------------------- */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Authors
                </p>
                {paper.authors?.map((author, i) => (
                  <div key={i} className="mb-1">
                    <span className="text-sm font-medium text-foreground">{author.name}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{author.email}</span>
                  </div>
                ))}
              </div>

              <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Scores
                </p>

                {/*
                  FIX: Avg Technical Score is hidden for organizer-reviewed papers.
                  There are no reviewer scores to average, so showing it is misleading.
                */}
                {!wasReviewedByOrganizer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Technical Score</span>
                    <span className="font-semibold text-foreground">
                      {paper.avgTechConfidence !== "N/A" ? paper.avgTechConfidence : "N/A"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IEEE Compliance</span>
                  <span className="font-semibold text-foreground">
                    {paper.complianceScore != null ? `${paper.complianceScore}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plagiarism Score</span>
                  <span className={`font-semibold ${getPlagiarismColor(plagiarismScore)}`}>
                    {plagiarismScore != null ? `${plagiarismScore}%` : "Not entered"}
                  </span>
                </div>
              </div>

              {/* System recommendation — only useful when reviewer scores exist */}
              {!wasReviewedByOrganizer && (!paper.decision || paper.decision === "pending") && (
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    System Recommendation
                  </p>
                  <span
                    className={`text-sm font-semibold ${
                      paper.avgTechConfidence > 6
                        ? "text-green-600 dark:text-green-400"
                        : paper.avgTechConfidence > 4
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {paper.avgTechConfidence > 6
                      ? "Accept"
                      : paper.avgTechConfidence > 4
                      ? "Modification Required"
                      : "Reject"}
                  </span>
                </div>
              )}
            </div>

            {/* --------------------------------------------------------------
                Column 2 — Organizer panel OR reviewer list
            -------------------------------------------------------------- */}
            <div className="lg:col-span-1">
              {wasReviewedByOrganizer ? (
                /* ---- Organizer-reviewed branch ---- */
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Review
                  </p>

                  <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-teal-100/60 dark:bg-teal-900/40 border-b border-teal-200 dark:border-teal-800">
                      <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                        Directly Reviewed by Editor
                      </span>
                    </div>
                    <div className="px-3 py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Decision</span>
                        {getDecisionBadge(paper.decision)}
                      </div>
                      {organizerComments ? (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Comments for Authors
                          </p>
                          <p className="text-sm text-foreground bg-blue-50 dark:bg-blue-950/30 rounded p-2 leading-relaxed">
                            {organizerComments}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No comments were left for the authors.
                        </p>
                      )}
                    </div>
                  </div>

                  {/*
                    FIX: Plain <button> instead of shadcn <Button variant="ghost" p-0 h-auto>
                    because zero-dimension utility classes can collapse the element invisibly.
                  */}
                  <button
                    type="button"
                    onClick={(e) => handleViewFullReviews(currentPaperId, currentPaperTitle, e)}
                    className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline text-sm mt-1"
                  >
                    <FileText className="h-3 w-3" />
                    View Full Reviews
                  </button>
                </div>
              ) : (
                /* ---- Reviewer-assigned branch ---- */
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Reviewers ({paper.reviewers?.length || 0})
                  </p>
                  {paper.reviewers?.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No reviewers assigned yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {paper.reviewers?.map((reviewer, i) => {
                        const key = `${currentPaperId}-${i}`;
                        const isExpanded = expandedReviewer === key;
                        const hasComments =
                          reviewer.commentsForAuthors || reviewer.commentsForOrganizers;

                        return (
                          <Card key={i} className="overflow-hidden border-border">
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">
                                  {reviewer.name}
                                </span>
                                {getStatusBadge(reviewer.status)}
                                {getRecommendationBadge(reviewer.recommendation)}
                              </div>
                              {reviewer.status === "reviewed" && hasComments && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleReviewer(key)}
                                  className="h-7 px-2 text-teal-600 dark:text-teal-400"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {isExpanded && reviewer.status === "reviewed" && (
                              <div className="px-3 py-3 space-y-3 border-t border-border bg-card">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground font-medium">
                                    Technical Confidence
                                  </span>
                                  <span className="font-semibold text-foreground">
                                    {reviewer.technicalConfidence !== "0.00"
                                      ? reviewer.technicalConfidence
                                      : "N/A"}
                                  </span>
                                </div>
                                {reviewer.commentsForAuthors && (
                                  <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                      Comments for Authors
                                    </p>
                                    <p className="text-sm text-foreground bg-blue-50 dark:bg-blue-950/30 rounded p-2 leading-relaxed">
                                      {reviewer.commentsForAuthors}
                                    </p>
                                  </div>
                                )}
                                {reviewer.commentsForOrganizers && (
                                  <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                      Comments for Editors
                                    </p>
                                    <p className="text-sm text-foreground bg-yellow-50 dark:bg-yellow-950/30 rounded p-2 leading-relaxed">
                                      {reviewer.commentsForOrganizers}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleViewFullReviews(currentPaperId, currentPaperTitle, e)}
                    className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline text-sm mt-3"
                  >
                    <FileText className="h-3 w-3" />
                    View Full Reviews
                  </button>
                </>
              )}
            </div>

            {/* --------------------------------------------------------------
                Column 3 — Final Decision
            -------------------------------------------------------------- */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Final Decision
              </p>
              {!paper.decision || paper.decision === "pending" ? (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleDecision(currentPaperId, "Accepted")}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleDecision(currentPaperId, "Rejected")}
                    variant="destructive"
                    className="w-full"
                  >
                    Reject
                  </Button>
                  {paper.status !== "resubmitted" && (
                    <Button
                      onClick={() => handleDecision(currentPaperId, "Modification Required")}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Modifications Required
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 bg-muted/30 rounded-lg border border-border">
                  {getDecisionBadge(paper.decision) || (
                    <span className="text-sm text-muted-foreground">{paper.decision}</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout title="ConForum - Review Management">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-1">Review Management</h1>
                  <p className="text-muted-foreground text-sm">
                    {conferenceName || "Conference"} — Track reviews and make decisions on submitted
                    papers.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Tabs
                defaultValue="reviewers"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="border-b border-border px-6 pt-4">
                  <TabsList className="bg-transparent">
                    <TabsTrigger
                      value="reviewers"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:rounded-none px-4"
                    >
                      <span className="flex items-center gap-2">
                        Reviewed by Reviewers
                        <Badge variant="secondary" className="ml-1">
                          {reviewerReviewedPapers.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="organizer"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:rounded-none px-4"
                    >
                      <span className="flex items-center gap-2">
                        Reviewed by Me
                        <Badge variant="secondary" className="ml-1">
                          {organizerReviewedPapers.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="unreviewed"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:rounded-none px-4"
                    >
                      <span className="flex items-center gap-2">
                        Unreviewed
                        <Badge variant="secondary" className="ml-1">
                          {unreviewedPapers.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="reviewers" className="mt-0">
                  {loading ? (
                    <div className="p-6 space-y-6">
                      {[1, 2, 3].map((i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6 p-6">{renderPapersList(reviewerReviewedPapers)}</div>
                  )}
                </TabsContent>

                <TabsContent value="organizer" className="mt-0">
                  {loading ? (
                    <div className="p-6 space-y-6">
                      {[1, 2, 3].map((i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6 p-6">{renderPapersList(organizerReviewedPapers)}</div>
                  )}
                </TabsContent>

                <TabsContent value="unreviewed" className="mt-0">
                  {loading ? (
                    <div className="p-6 space-y-6">
                      {[1, 2, 3].map((i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6 p-6">{renderPapersList(unreviewedPapers)}</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewManagement;