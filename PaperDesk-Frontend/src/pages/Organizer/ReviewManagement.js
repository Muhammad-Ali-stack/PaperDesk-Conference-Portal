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
import {
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Pencil,
  X,
  Check,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Due Date Helpers
// -----------------------------------------------------------------------------
function formatDueDate(dueDateUTC) {
  if (!dueDateUTC) return null;
  return new Date(dueDateUTC).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDueDateStatus(dueDateUTC) {
  if (!dueDateUTC) return null;
  const now = new Date();
  const due = new Date(dueDateUTC);
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft <= 24) return "urgent";
  if (hoursLeft <= 72) return "soon";
  return "ok";
}

// Local "now", truncated to the minute, formatted for a datetime-local input's min attribute
function getLocalDateTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DueDatePill({ dueDateUTC }) {
  const formatted = formatDueDate(dueDateUTC);
  const status = getDueDateStatus(dueDateUTC);
  if (!formatted) return null;

  const styles = {
    overdue: "text-red-600 bg-red-50 border-red-200",
    urgent: "text-orange-600 bg-orange-50 border-orange-200",
    soon: "text-yellow-700 bg-yellow-50 border-yellow-200",
    ok: "text-green-700 bg-green-50 border-green-200",
  };
  const Icon = status === "overdue" || status === "urgent" ? AlertTriangle : Clock;
  const label = status === "overdue" ? "Overdue" : "Due";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles[status]}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}: {formatted}
    </span>
  );
}

// -----------------------------------------------------------------------------
// PDF Validation Badge
// -----------------------------------------------------------------------------
function ValidationBadge({ validationInfo }) {
  if (validationInfo === null || validationInfo === undefined) {
    return <span className="text-muted-foreground text-xs italic">No validation data</span>;
  }

  const isValid = validationInfo.validated === true;

  if (isValid) {
    return (
      <span
        className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold"
        title={validationInfo.message ?? "Valid PDF"}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Valid
      </span>
    );
  }

  const debugInfo = JSON.stringify(validationInfo, null, 2);
  return (
    <span
      className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold cursor-help"
      title={`Stored validation info:\n${debugInfo}`}
    >
      <XCircle className="h-3.5 w-3.5" />
      Invalid
    </span>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
const ReviewManagement = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const navigate = useNavigate();

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviewer, setExpandedReviewer] = useState(null);
  const [submissionStatuses, setSubmissionStatuses] = useState({});
  const [activeTab, setActiveTab] = useState("reviewers");
  const [editingDueDateFor, setEditingDueDateFor] = useState(null);
  const [dueDateInputs, setDueDateInputs] = useState({});
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (conferenceId) fetchData();
  }, [conferenceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/organizer/review-management/${conferenceId}`);
      const data = response.data?.data ?? response.data;
      let papers = Array.isArray(data) ? data : [];
      papers.sort((a, b) => {
        const getDate = (p) =>
          p.assignedAt || p.latest_assigned_at || p.assigned_at || p.created_at || p.submittedDate || null;
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
      navigate(
        `/userdashboard/reviews?paperId=${encodeURIComponent(paperId)}&conferenceId=${encodeURIComponent(conferenceId)}`
      );
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

  const handleEditDueDate = (paperId, currentDueDateUTC) => {
    let localValue = "";
    if (currentDueDateUTC) {
      const d = new Date(currentDueDateUTC);
      const pad = (n) => String(n).padStart(2, "0");
      localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    setDueDateInputs((prev) => ({ ...prev, [paperId]: localValue }));
    setEditingDueDateFor(paperId);
  };
  const handleCancelEditDueDate = () => setEditingDueDateFor(null);
  const handleSaveDueDate = async (paperId) => {
    const dueDate = dueDateInputs[paperId];
    // Guard against past dates even if the browser's native min-date check is bypassed
    // (manual typing, older browsers, etc). Clearing the date (empty string) is still allowed.
    if (dueDate && new Date(dueDate) < new Date()) {
      toast.error("Due date cannot be set in the past.");
      return;
    }
    setSavingDueDate(true);
    try {
      await axios.patch(`/api/organizer/assignments/${paperId}/due-date`, {
        dueDate: dueDate || null,
        timezone,
      });
      toast.success("Due date updated successfully.");
      setEditingDueDateFor(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update due date.");
    } finally {
      setSavingDueDate(false);
    }
  };
  const toggleReviewer = (key) => setExpandedReviewer((prev) => (prev === key ? null : key));

  const getStatusBadge = (status) =>
    status === "reviewed"
      ? <Badge variant="success">Reviewed</Badge>
      : <Badge variant="warning">Pending</Badge>;

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
    if (decision === "Modification Required") return <Badge variant="warning">Modification Required</Badge>;
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

  // Filter tableData by search query (manuscript number or title)
  const filteredData = searchQuery.trim()
    ? tableData.filter(
        (p) =>
          p.manuscriptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tableData;

  const reviewerReviewedPapers = filteredData.filter((p) =>
    p.reviewers?.some((r) => r.status === "reviewed")
  );
  const organizerReviewedPapers = filteredData.filter(
    (p) =>
      p.decision &&
      p.decision !== "pending" &&
      (!p.reviewers || p.reviewers.length === 0)
  );
  const unreviewedPapers = filteredData.filter((p) => {
    const noDecision = !p.decision || p.decision === "pending";
    const noReviewerReviewed =
      !p.reviewers ||
      p.reviewers.length === 0 ||
      !p.reviewers.some((r) => r.status === "reviewed");
    const notOrganizerReviewed = !(
      p.decision &&
      p.decision !== "pending" &&
      (!p.reviewers || p.reviewers.length === 0)
    );
    return noDecision && noReviewerReviewed && notOrganizerReviewed;
  });

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

  const renderPapersList = (papersList) => {
    if (papersList.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {searchQuery.trim()
              ? "No papers match your search."
              : "No papers in this category."}
          </CardContent>
        </Card>
      );
    }

    return papersList.map((paper, index) => {
      const currentPaperId = paper.paperId;
      const currentPaperTitle = paper.title;
      const status = submissionStatuses[currentPaperId];
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
      const paperDueDate = paper.dueDate ?? paper.reviewers?.[0]?.dueDate ?? null;
      const validationInfo = paper.validationInfo ?? paper.validation_info ?? null;

      // A paper's due date is only relevant if there are still pending reviewers
      const allReviewersFinished =
        paper.reviewers?.length > 0 &&
        paper.reviewers.every((r) => r.status === "reviewed");
      // Once a final decision has been made, the deadline no longer matters either
      const hasFinalDecision = Boolean(paper.decision) && paper.decision !== "pending";
      const dueDateIrrelevant = allReviewersFinished || hasFinalDecision;

      return (
        <Card key={currentPaperId} className="overflow-hidden">
          {/* Card header (teal bar) */}
          <div className="bg-teal-700 dark:bg-teal-900 text-white px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm opacity-70">#{index + 1}</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-base">{paper.title}</span>
                {paper.manuscriptNumber && (
                  <span className="text-xs font-mono text-white/70">
                    Manuscript ID: {paper.manuscriptNumber}
                  </span>
                )}
              </div>
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
              {/* Only show due date in header if it's still relevant */}
              {paperDueDate && !dueDateIrrelevant && (
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    getDueDateStatus(paperDueDate) === "overdue"
                      ? "bg-red-500/80 text-white"
                      : getDueDateStatus(paperDueDate) === "urgent"
                      ? "bg-orange-400/80 text-white"
                      : getDueDateStatus(paperDueDate) === "soon"
                      ? "bg-yellow-400/80 text-gray-900"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {getDueDateStatus(paperDueDate) === "overdue" ||
                  getDueDateStatus(paperDueDate) === "urgent" ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {getDueDateStatus(paperDueDate) === "overdue" ? "Overdue" : "Due"}:{" "}
                  {formatDueDate(paperDueDate)}
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
            {/* Column 1 – Authors and Scores */}
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
                {!wasReviewedByOrganizer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Technical Score</span>
                    <span className="font-semibold text-foreground">
                      {paper.avgTechConfidence !== "N/A" ? paper.avgTechConfidence : "N/A"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">PDF Validation</span>
                  <ValidationBadge validationInfo={validationInfo} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plagiarism Score</span>
                  <span className={`font-semibold ${getPlagiarismColor(plagiarismScore)}`}>
                    {plagiarismScore != null ? `${plagiarismScore}%` : "Not entered"}
                  </span>
                </div>
              </div>
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

            {/* Column 2 – Organizer panel OR reviewer list */}
            <div className="lg:col-span-1">
              {wasReviewedByOrganizer ? (
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
                  <button
                    type="button"
                    onClick={(e) => handleViewFullReviews(currentPaperId, currentPaperTitle, e)}
                    className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline text-sm mt-1"
                  >
                    <FileText className="h-3 w-3" /> View Full Reviews
                  </button>
                </div>
              ) : (
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

                        // Only show due date on the reviewer card if they haven't reviewed yet
                        const reviewerDueDate =
                          reviewer.status === "reviewed"
                            ? null
                            : (reviewer.dueDate ?? paperDueDate);

                        const dueDateStatus = getDueDateStatus(reviewerDueDate);
                        return (
                          <Card
                            key={i}
                            className={`overflow-hidden border-border ${
                              dueDateStatus === "overdue" ? "border-red-200" : ""
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between px-3 py-2 ${
                                dueDateStatus === "overdue"
                                  ? "bg-red-50/60 dark:bg-red-950/20"
                                  : "bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col gap-1 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">
                                    {reviewer.name}
                                  </span>
                                  {getStatusBadge(reviewer.status)}
                                  {getRecommendationBadge(reviewer.recommendation)}
                                </div>
                                {/* DueDatePill is null-safe; only renders when reviewerDueDate is set */}
                                <DueDatePill dueDateUTC={reviewerDueDate} />
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
                    <FileText className="h-3 w-3" /> View Full Reviews
                  </button>
                </>
              )}
            </div>

            {/* Column 3 – Due Date Editor + Final Decision */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Review Due Date
              </p>
              {editingDueDateFor === currentPaperId ? (
                <div className="mb-4 space-y-2">
                  <input
                    type="datetime-local"
                    value={dueDateInputs[currentPaperId] || ""}
                    min={getLocalDateTimeNow()}
                    onChange={(e) =>
                      setDueDateInputs((prev) => ({ ...prev, [currentPaperId]: e.target.value }))
                    }
                    className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-muted-foreground">Timezone: {timezone}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                      onClick={() => handleSaveDueDate(currentPaperId)}
                      disabled={savingDueDate}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {savingDueDate ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={handleCancelEditDueDate}
                      disabled={savingDueDate}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                  {dueDateInputs[currentPaperId] && (
                    <button
                      type="button"
                      onClick={() =>
                        setDueDateInputs((prev) => ({ ...prev, [currentPaperId]: "" }))
                      }
                      className="text-[10px] text-red-500 hover:underline w-full text-left"
                    >
                      Clear due date (remove deadline)
                    </button>
                  )}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    {paperDueDate && !dueDateIrrelevant ? (
                      <DueDatePill dueDateUTC={paperDueDate} />
                    ) : hasFinalDecision ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Decision finalized
                      </span>
                    ) : paperDueDate && allReviewersFinished ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle className="h-3.5 w-3.5" />
                        All reviews submitted
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No deadline set</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={() => handleEditDueDate(currentPaperId, paperDueDate)}
                    disabled={dueDateIrrelevant}
                    title={
                      hasFinalDecision
                        ? "A final decision has already been made"
                        : allReviewersFinished
                        ? "All reviews are already submitted"
                        : undefined
                    }
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {paperDueDate ? "Edit" : "Set"}
                  </Button>
                </div>
              )}
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

  return (
    <Layout title="PaperDesk - Review Management">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-1">Review Management</h1>
                  <p className="text-muted-foreground text-sm">
                    {conferenceName || "Conference"} — Track reviews and make decisions on submitted papers.
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by manuscript ID or title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
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
                      {Array.from({ length: 3 }, (_, i) => <TableRowSkeleton key={i} />)}
                    </div>
                  ) : (
                    <div className="space-y-6 p-6">{renderPapersList(reviewerReviewedPapers)}</div>
                  )}
                </TabsContent>
                <TabsContent value="organizer" className="mt-0">
                  {loading ? (
                    <div className="p-6 space-y-6">
                      {Array.from({ length: 3 }, (_, i) => <TableRowSkeleton key={i} />)}
                    </div>
                  ) : (
                    <div className="space-y-6 p-6">{renderPapersList(organizerReviewedPapers)}</div>
                  )}
                </TabsContent>
                <TabsContent value="unreviewed" className="mt-0">
                  {loading ? (
                    <div className="p-6 space-y-6">
                      {Array.from({ length: 3 }, (_, i) => <TableRowSkeleton key={i} />)}
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