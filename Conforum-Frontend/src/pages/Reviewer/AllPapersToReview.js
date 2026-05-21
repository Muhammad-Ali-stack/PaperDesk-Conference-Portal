import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/Auth";
import Layout from "../../components/Layout";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { FileText, Download, CheckCircle, Info, RefreshCw } from "lucide-react";

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
  const pendingCount = assignedPapers.filter(p => !p.isReviewedBy?.includes(reviewerId) && p.finalDecision === "pending").length;

  const getPlagiarismBadge = (paper) => {
    const score = paper.plagiarismScore ?? paper.organizer_plagiarism_score;
    if (score === undefined || score === null) return null;
    if (score <= 15) return <Badge variant="success" className="text-xs">Plagiarism: {score}% (Low)</Badge>;
    if (score <= 25) return <Badge variant="warning" className="text-xs">Plagiarism: {score}% (Moderate)</Badge>;
    return <Badge variant="destructive" className="text-xs">Plagiarism: {score}% (High)</Badge>;
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
              {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
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
                const isReviewed = paper.isReviewedBy?.includes(reviewerId);
                const decisionGiven = paper.finalDecision && paper.finalDecision !== "pending";
                const disabled = isReviewed || decisionGiven;

                return (
                  <Card key={paper.paperId} className={`transition-shadow ${disabled ? "opacity-60 grayscale pointer-events-none" : "hover:shadow-md"}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="teal" className="text-[10px]">{paper.conferenceAcronym}</Badge>
                            {isReviewed && <Badge variant="success" className="text-[10px]">Reviewed</Badge>}
                            {decisionGiven && <Badge variant="secondary" className="text-[10px]">Final Decision Given by Editor</Badge>}
                            {getPlagiarismBadge(paper)}
                          </div>
                          <h2 className="font-bold text-base mb-1 truncate">{paper.title}</h2>
                          {paper.abstract && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{paper.abstract}</p>
                          )}
                          <p className="text-xs text-muted-foreground font-medium">{paper.conferenceName}</p>
                          {decisionGiven && (
                            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                              <Info className="h-3.5 w-3.5 flex-shrink-0" />
                              Organizer has already given a final decision on this paper
                            </div>
                          )}
                        </div>
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