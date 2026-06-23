import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import DonutChart from "../../components/DonutChart";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Users, ShieldCheck, CheckCircle, XCircle } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPaperStatusBadge = (status, hasReviews, decision) => {
  if (decision && decision !== "pending") return getDecisionBadge(decision);
  if (status === "assigned" && !hasReviews) return <Badge variant="warning">Assigned to Reviewer</Badge>;
  if (hasReviews) return <Badge variant="success">Reviewed</Badge>;
  return <Badge variant="secondary">Pending Review</Badge>;
};

const getDecisionBadge = (decision) => {
  if (decision === "Accepted") return <Badge variant="success">Accepted</Badge>;
  if (decision === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (decision === "Modification Required") return <Badge variant="warning">Modification Required</Badge>;
  if (decision === "Assigned") return <Badge variant="purple">Assigned</Badge>;
  return <Badge variant="outline">{decision}</Badge>;
};

const getPlagiarismBadgeClass = (score) => {
  if (score === null || score === undefined) return "bg-muted text-muted-foreground";
  if (score <= 15) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score <= 25) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
};

const getPlagiarismLabel = (score) => {
  if (score === null || score === undefined) return "Not recorded";
  if (score <= 15) return "Low Similarity";
  if (score <= 25) return "Moderate Similarity";
  return "High Similarity";
};

// ─── PDF Validation Block ─────────────────────────────────────────────────────

const ValidationInfoBlock = ({ validationInfo }) => {
  if (validationInfo === null || validationInfo === undefined) return null;
  const isValid = validationInfo.validated === true || validationInfo.isValid === true;
  return (
    <div
      className={`inline-flex items-start gap-2 px-3 py-2 rounded-lg text-sm border ${
        isValid
          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
      }`}
    >
      {isValid ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
      <div className="space-y-0.5">
        <p className="font-semibold text-xs">{isValid ? "PDF Valid" : "PDF Invalid"}</p>
        <p className="text-xs opacity-80">{validationInfo.message}</p>
        {validationInfo.fileInfo && (
          <p className="text-xs opacity-70">
            {validationInfo.fileInfo.pages != null && `Pages: ${validationInfo.fileInfo.pages}`}
            {validationInfo.fileInfo.pages != null && validationInfo.fileInfo.sizeMB != null && " · "}
            {validationInfo.fileInfo.sizeMB != null && `Size: ${validationInfo.fileInfo.sizeMB} MB`}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Skeletons ────────────────────────────────────────────────────────────────

const PaperCardSkeleton = () => (
  <Card className="mb-6">
    <CardContent className="p-6">
      <div className="flex justify-between items-start flex-wrap gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-[250px] space-y-4">
          {/* Title + badge row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          {/* Authors */}
          <Skeleton className="h-4 w-64" />
          {/* Plagiarism row */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
          {/* PDF validation */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-56 rounded-lg" />
          </div>
        </div>
        {/* Right column – donut placeholder */}
        <div className="flex items-center justify-center">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ReviewCardSkeleton = () => (
  <Card className="mb-4">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          {/* Reviewer name */}
          <Skeleton className="h-5 w-48" />
          {/* Email */}
          <Skeleton className="h-4 w-60" />
          {/* Score grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
          {/* Recommendation + confidence */}
          <div className="flex gap-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Comments block */}
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ReviewDetails = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [searchParams, setSearchParams] = useSearchParams();

  const [papers, setPapers] = useState([]);
  const [reviewManagementData, setReviewManagementData] = useState([]);

  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [reviewMgmtPaper, setReviewMgmtPaper] = useState(null);
  const [reviews, setReviews] = useState([]);

  const [loadingPapers, setLoadingPapers] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState(null);

  const autoSelectDone = useRef(false);
  const abortControllerRef = useRef(null);

  // 1. Fetch papers and review management data on mount
  useEffect(() => {
    if (!conferenceId) return;

    const fetchInitialData = async () => {
      setLoadingPapers(true);
      try {
        const [papersRes, mgmtRes] = await Promise.allSettled([
          axios.get(`/api/conference/${conferenceId}/papers`),
          axios.get(`/api/organizer/review-management/${conferenceId}`),
        ]);

        let papersList = [];
        if (papersRes.status === "fulfilled") {
          papersList = papersRes.value.data?.data?.papers ?? papersRes.value.data?.papers ?? [];
          setPapers(papersList);
        }

        let mgmtList = [];
        if (mgmtRes.status === "fulfilled") {
          const raw = mgmtRes.value.data?.data ?? mgmtRes.value.data;
          mgmtList = Array.isArray(raw) ? raw : [];
          setReviewManagementData(mgmtList);
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError("Failed to load papers.");
      } finally {
        setLoadingPapers(false);
      }
    };
    fetchInitialData();
  }, [conferenceId]);

  // 2. Sync selectedPaperId with URL query parameter
  useEffect(() => {
    if (loadingPapers) return;

    const paperIdFromUrl = searchParams.get("paperId");
    if (paperIdFromUrl) {
      const paperExists = papers.some((p) => String(p.id || p._id) === paperIdFromUrl);
      if (paperExists && selectedPaperId !== paperIdFromUrl) {
        setSelectedPaperId(paperIdFromUrl);
        autoSelectDone.current = true;
      }
    } else if (!selectedPaperId && papers.length > 0 && !autoSelectDone.current) {
      // Build a Set of paper IDs that are selectable:
      // a paper is selectable if its status is NOT "pending",
      // OR if the organizer has already made a decision on it.
      //
      // FIX: use String(p.paperId) from reviewManagementData to match
      // String(p.id || p._id) from the papers list — both sides stringified.
      const decidedIds = new Set(
        reviewManagementData
          .filter((p) => p.decision && p.decision !== "pending")
          .map((p) => String(p.paperId))
      );

      const firstSelectable = papers.find((p) => {
        const id = String(p.id || p._id);
        // selectable if assigned/reviewed, OR organizer already decided
        return p.status !== "pending" || decidedIds.has(id);
      });

      if (firstSelectable) {
        const newId = String(firstSelectable.id || firstSelectable._id);
        setSelectedPaperId(newId);
        setSearchParams({ paperId: newId, conferenceId });
        autoSelectDone.current = true;
      }
    }
  }, [papers, reviewManagementData, loadingPapers, searchParams, selectedPaperId, conferenceId, setSearchParams]);

  // 3. Fetch reviews when selectedPaperId changes
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (!selectedPaperId) {
      setReviewMgmtPaper(null);
      setReviews([]);
      return;
    }

    // FIX: both sides stringified so the lookup never misses due to type mismatch
    const mgmtEntry = reviewManagementData.find(
      (p) => String(p.paperId) === String(selectedPaperId)
    );
    setReviewMgmtPaper(mgmtEntry ?? null);

    const fetchReviews = async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoadingReviews(true);
      setError(null);

      try {
        const reviewsRes = await axios.get(`/api/organizer/reviews/${selectedPaperId}`, {
          signal: controller.signal,
        });
        const list = reviewsRes.data?.data ?? reviewsRes.data ?? [];
        setReviews(Array.isArray(list) ? list : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching reviews:", err);
          setReviews([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [selectedPaperId, reviewManagementData]);

  const handlePaperSelect = (paperId) => {
    setSelectedPaperId(paperId);
    setSearchParams({ paperId, conferenceId });
  };

  // Derived values
  const organizerPlagiarismScore = reviewMgmtPaper?.plagiarismScore ?? null;
  const hasOrganizerScore = organizerPlagiarismScore !== null && organizerPlagiarismScore !== undefined;
  const decision = reviewMgmtPaper?.decision ?? null;
  const wasReviewedByOrganizer =
    !!reviewMgmtPaper && !!decision && decision !== "pending" && reviews.length === 0;
  const organizerComments = reviewMgmtPaper?.organizerCommentsForAuthors ?? null;
  const validationInfo = reviewMgmtPaper?.validationInfo ?? reviewMgmtPaper?.validation_info ?? null;

  // FIX: build decidedIds with String() on both sides — same fix as the auto-select above
  const decidedIds = new Set(
    reviewManagementData
      .filter((p) => p.decision && p.decision !== "pending")
      .map((p) => String(p.paperId))
  );

  return (
    <Layout title="PaperDesk - Review Details">
      <div className="flex-1 p-6 lg:p-10 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center text-foreground">
            {conferenceName || "Conference"} – Review Details
          </h2>

          {/* Paper selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">Select Paper</label>
            {loadingPapers ? (
              <Skeleton className="h-10 w-full md:w-96 rounded-md" />
            ) : (
              <Select value={selectedPaperId || ""} onValueChange={handlePaperSelect}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Choose a paper..." />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((paper) => {
                    const paperId = String(paper.id || paper._id);
                    // A paper is selectable if it has been assigned/reviewed,
                    // OR the organizer has already made a decision on it.
                    // "pending" = just submitted, no reviewer assigned yet → grey out.
                    const isOrganizerDecided = decidedIds.has(paperId);
                    const isDisabled = paper.status === "pending" && !isOrganizerDecided;
                    return (
                      <SelectItem
                        key={paperId}
                        value={paperId}
                        disabled={isDisabled}
                        className={isDisabled ? "text-muted-foreground italic" : ""}
                      >
                        {paper.title}
                        {isDisabled && " (Pending Assignment)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive mb-6">
              {error}
            </div>
          )}

          {loadingReviews ? (
            <>
              <PaperCardSkeleton />
              <Skeleton className="h-7 w-36 mb-4" />
              <ReviewCardSkeleton />
              <ReviewCardSkeleton />
            </>
          ) : reviewMgmtPaper ? (
            <>
              {/* Paper Info Card */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start flex-wrap gap-6">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="text-2xl text-foreground font-semibold">{reviewMgmtPaper.title}</h3>
                        {getPaperStatusBadge(reviewMgmtPaper.status, reviews.length > 0, decision)}
                      </div>
                      <p className="text-muted-foreground text-base leading-relaxed">
                        <span className="font-medium text-foreground">Author(s):</span>{" "}
                        {reviewMgmtPaper.authors?.length > 0
                          ? reviewMgmtPaper.authors.map((author) => `${author.name} (${author.email})`).join(", ")
                          : "N/A"}
                      </p>

                      <div className="mt-4">
                        <span className="text-sm font-medium text-muted-foreground">Plagiarism Score: </span>
                        {hasOrganizerScore ? (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getPlagiarismBadgeClass(
                              organizerPlagiarismScore
                            )}`}
                          >
                            {organizerPlagiarismScore}%
                            <span className="font-normal text-xs">— {getPlagiarismLabel(organizerPlagiarismScore)}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Not recorded by Editor</span>
                        )}
                      </div>

                      <div className="mt-4">
                        <span className="text-sm font-medium text-muted-foreground block mb-2">PDF Validation:</span>
                        <ValidationInfoBlock validationInfo={validationInfo} />
                        {validationInfo === null && (
                          <span className="text-sm text-muted-foreground italic">No validation data available.</span>
                        )}
                      </div>
                    </div>

                    {hasOrganizerScore && (
                      <div className="flex gap-10 items-center flex-wrap">
                        <DonutChart
                          value={Number(organizerPlagiarismScore).toFixed(2)}
                          label="Plagiarism"
                          color={
                            organizerPlagiarismScore <= 15
                              ? "#10b981"
                              : organizerPlagiarismScore <= 25
                              ? "#f59e0b"
                              : "#ef4444"
                          }
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Review Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 text-foreground">Review Details</h2>

                {wasReviewedByOrganizer ? (
                  <Card className="border-teal-200 dark:border-teal-800">
                    <div className="flex items-center gap-2 px-5 py-3 bg-teal-100/60 dark:bg-teal-900/40 border-b border-teal-200 dark:border-teal-800 rounded-t-lg">
                      <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      <span className="text-base font-semibold text-teal-700 dark:text-teal-300">Reviewed by Editor</span>
                    </div>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">Decision:</span>
                        {getDecisionBadge(decision)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Comments for Authors</p>
                        {organizerComments ? (
                          <p className="text-sm text-foreground bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 leading-relaxed">
                            {organizerComments}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No comments were left for the authors.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : reviews.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      No reviews have been submitted for this paper yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review, index) => (
                      <Card key={review.id || index}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground">Reviewer: {review.users?.name || "N/A"}</h3>
                              <p className="text-sm text-muted-foreground mb-3">Email: {review.users?.email || "N/A"}</p>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                {[
                                  ["Originality", review.originality],
                                  ["Technical Quality", review.technical_quality],
                                  ["Significance", review.significance],
                                  ["Clarity", review.clarity],
                                  ["Relevance", review.relevance],
                                ].map(([label, val]) => (
                                  <div key={label}>
                                    <span className="font-medium text-muted-foreground">{label}:</span>
                                    <p className="text-foreground">{val ?? "N/A"}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <span className="font-medium text-muted-foreground">Overall Recommendation:</span>
                                <Badge variant="outline">{review.overall_recommendation}</Badge>
                              </div>
                              <div className="mt-2">
                                <span className="font-medium text-muted-foreground">Technical Confidence:</span>
                                <span className="ml-2 text-foreground">{review.technical_confidence || "N/A"}/10</span>
                              </div>
                              {review.comments_for_authors && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                  <p className="text-sm font-medium text-foreground mb-1">Comments for Authors:</p>
                                  <p className="text-sm text-muted-foreground">{review.comments_for_authors}</p>
                                </div>
                              )}
                              {review.comments_for_organizers && (
                                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                                  <p className="text-sm font-medium text-foreground mb-1">Comments for Editor:</p>
                                  <p className="text-sm text-muted-foreground">{review.comments_for_organizers}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : !loadingPapers && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Select a paper above to view its review details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ReviewDetails;