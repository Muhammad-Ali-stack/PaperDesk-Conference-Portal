import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/Auth";
import Layout from "../../components/Layout";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { FileText, Download, CheckCircle, Info, RefreshCw, Clock, AlertTriangle } from "lucide-react";

// ─── Due Date Helpers ────────────────────────────────────────────────────────

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

  if (hoursLeft < 0)   return "overdue";   // past deadline
  if (hoursLeft <= 24) return "urgent";    // < 24 hours left
  if (hoursLeft <= 72) return "soon";      // < 3 days left
  return "ok";
}

function DueDateBadge({ dueDateUTC }) {
  const formatted = formatDueDate(dueDateUTC);
  const status = getDueDateStatus(dueDateUTC);

  if (!formatted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        No deadline
      </span>
    );
  }

  const styles = {
    overdue: "text-red-600 bg-red-50 border-red-200",
    urgent:  "text-orange-600 bg-orange-50 border-orange-200",
    soon:    "text-yellow-700 bg-yellow-50 border-yellow-200",
    ok:      "text-green-700 bg-green-50 border-green-200",
  };

  const icons = {
    overdue: <AlertTriangle className="w-3 h-3" />,
    urgent:  <AlertTriangle className="w-3 h-3" />,
    soon:    <Clock className="w-3 h-3" />,
    ok:      <Clock className="w-3 h-3" />,
  };

  const labels = {
    overdue: "Overdue",
    urgent:  "Due soon",
    soon:    "Due soon",
    ok:      "Due",
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${styles[status]}`}>
      {icons[status]}
      {labels[status]}: {formatted}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const AllPapersToReview = () => {
  const [assignedPapers, setAssignedPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auth] = useAuth();
  const reviewerId = auth?.user?._id;
  const intervalRef = useRef(null);

  const fetchAssignedPapers = useCallback(async (silent = false) => {
    if (!reviewerId) return;
    if (!silent) setRefreshing(true);
    try {
      const response = await axios.get(`/api/reviewer/assigned-papers/reviewer/${reviewerId}`);
      const rawData = response.data.data || [];
      // Sort by assignedAt descending – newest first
      const sorted = [...rawData].sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
      setAssignedPapers(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  }, [reviewerId]);

  useEffect(() => {
    fetchAssignedPapers(false);
    intervalRef.current = setInterval(() => {
      fetchAssignedPapers(true);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAssignedPapers]);

  const handleRefresh = () => {
    fetchAssignedPapers(false);
  };

  const reviewedCount = assignedPapers.filter(p => p.isReviewedBy?.includes(reviewerId)).length;
  const pendingCount  = assignedPapers.filter(p => !p.isReviewedBy?.includes(reviewerId) && p.finalDecision === "pending").length;

  const getPlagiarismBadge = (paper) => {
    const score = paper.plagiarismScore ?? paper.organizer_plagiarism_score;
    if (score === undefined || score === null) return null;
    if (score <= 15) return <Badge variant="success"   className="text-xs">Plagiarism: {score}% (Low)</Badge>;
    if (score <= 25) return <Badge variant="warning"   className="text-xs">Plagiarism: {score}% (Moderate)</Badge>;
    return               <Badge variant="destructive" className="text-xs">Plagiarism: {score}% (High)</Badge>;
  };

  return (
    <Layout title="PaperDesk - Review Assignments">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Review Assignments</h1>
              <p className="text-muted-foreground mt-1 text-sm">Evaluate and provide feedback on submitted manuscripts</p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-sm px-3 py-1">{reviewedCount} Reviewed</Badge>
                  <Badge variant="warning" className="text-sm px-3 py-1">{pendingCount} Pending</Badge>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span className="ml-2 hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : assignedPapers.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-bold mb-1">Queue Clear</h3>
                <p className="text-muted-foreground text-sm">No pending papers to review. Check back later.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignedPapers.map((paper) => {
                const isReviewed    = paper.isReviewedBy?.includes(reviewerId);
                const decisionGiven = paper.finalDecision && paper.finalDecision !== "pending";
                const isOverdue     = getDueDateStatus(paper.dueDate) === "overdue";

                // Disable card if: already reviewed, decision given, OR past due date
                const disabled = isReviewed || decisionGiven || isOverdue;

                return (
                  <Card
                    key={paper.paperId}
                    className={`transition-shadow ${
                      disabled
                        ? "opacity-60 grayscale pointer-events-none"
                        : "hover:shadow-md"
                    } ${isOverdue && !isReviewed && !decisionGiven ? "border-red-200 bg-red-50/30" : ""}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                        <div className="flex-1 min-w-0">

                          {/* ── Badges row ── */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="teal" className="text-[10px]">{paper.conferenceAcronym}</Badge>
                            {isReviewed    && <Badge variant="success"   className="text-[10px]">Reviewed</Badge>}
                            {decisionGiven && <Badge variant="secondary" className="text-[10px]">Final Decision Given by Editor</Badge>}
                            {isOverdue && !isReviewed && !decisionGiven && (
                              <Badge variant="destructive" className="text-[10px]">Deadline Passed</Badge>
                            )}
                            {getPlagiarismBadge(paper)}
                          </div>

                          {/* ── Title & abstract ── */}
                          <h2 className="font-bold text-base mb-1 truncate">{paper.title}</h2>
                          {paper.abstract && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{paper.abstract}</p>
                          )}
                          <p className="text-xs text-muted-foreground font-medium mb-2">{paper.conferenceName}</p>

                          {/* ── Due date ── */}
                          <DueDateBadge dueDateUTC={paper.dueDate} />

                          {/* ── Info notices ── */}
                          {decisionGiven && (
                            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                              <Info className="h-3.5 w-3.5 flex-shrink-0" />
                              Organizer has already given a final decision on this paper
                            </div>
                          )}
                          {isOverdue && !isReviewed && !decisionGiven && (
                            <div className="flex items-center gap-1.5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                              The review deadline for this paper has passed
                            </div>
                          )}

                        </div>

                        {/* ── Action buttons ── */}
                        <div className="flex flex-col gap-2 md:w-44 flex-shrink-0">
                          {paper.paperFilePath && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={paper.paperFilePath} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
                              </a>
                            </Button>
                          )}
                          {isReviewed ? (
                            <Button size="sm" variant="secondary" disabled>
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Completed
                            </Button>
                          ) : decisionGiven ? (
                            <Button size="sm" variant="outline" disabled>Decision Given</Button>
                          ) : isOverdue ? (
                            <Button size="sm" variant="outline" disabled>
                              <Clock className="h-3.5 w-3.5 mr-1.5" /> Deadline Passed
                            </Button>
                          ) : (
                            <Button size="sm" asChild>
                              <Link to={`/userdashboard/review-form?reviewerId=${reviewerId}&paperId=${paper.paperId}&title=${encodeURIComponent(paper.title)}`}>
                                Evaluate
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AllPapersToReview;