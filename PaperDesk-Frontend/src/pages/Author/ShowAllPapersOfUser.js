import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  ExternalLink,
  CheckCircle,
  XCircle,
} from "lucide-react";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const statusVariant = (status) => {
  switch ((status || "").toLowerCase()) {
    case "reviewed":    return "success";
    case "assigned":    return "purple";
    case "resubmitted": return "info";
    default:            return "warning";
  }
};

const decisionVariant = (decision) => {
  switch ((decision || "").toLowerCase()) {
    case "accepted":               return "success";
    case "rejected":               return "destructive";
    case "modification required":  return "warning";
    default:                       return "secondary";
  }
};

const statusLabel = (status) => {
  const s = (status || "pending").toLowerCase();
  const map = { reviewed: "Reviewed", assigned: "Assigned", resubmitted: "Resubmitted", pending: "Pending" };
  return map[s] || s;
};

const decisionLabel = (decision) => {
  const d = (decision || "").toLowerCase();
  const map = { accepted: "Accepted", rejected: "Rejected", "modification required": "Modification Required" };
  return map[d] || d;
};

const ValidationBlock = ({ validationInfo }) => {
  if (validationInfo === null || validationInfo === undefined) {
    return <span className="text-xs text-muted-foreground italic">No validation data available.</span>;
  }
  const isValid = validationInfo.validated === true;
  return (
    <div className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-xs border ${
      isValid
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
        : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
    }`}>
      {isValid ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
      <div className="space-y-0.5">
        <p className="font-semibold">{isValid ? "Valid PDF" : "Invalid PDF"}</p>
        <p className="opacity-80">{validationInfo.message}</p>
        {validationInfo.fileInfo && (
          <p className="opacity-70">
            {validationInfo.fileInfo.pages != null && `Pages: ${validationInfo.fileInfo.pages}`}
            {validationInfo.fileInfo.pages != null && validationInfo.fileInfo.sizeMB != null && " · "}
            {validationInfo.fileInfo.sizeMB != null && `Size: ${validationInfo.fileInfo.sizeMB} MB`}
          </p>
        )}
      </div>
    </div>
  );
};

const DeleteModal = ({ title, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
    <Card className="w-full max-w-md animate-fade-in">
      <CardHeader><CardTitle className="text-base">Confirm Deletion</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-foreground">"{title}"</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const ResubmissionCounter = ({ submissionStatus }) => {
  if (!submissionStatus || submissionStatus.unlimited) return null;
  const remaining = submissionStatus.maxResubmissions - submissionStatus.currentCount;
  const isExhausted = remaining <= 0;
  return (
    <div className={`flex items-center gap-1.5 mt-2 text-xs px-2 py-1 rounded-md w-fit ${isExhausted ? "bg-destructive/10" : "bg-muted/50"}`}>
      {isExhausted ? (
        <span className="font-semibold text-destructive">No resubmissions left</span>
      ) : (
        <span className={`font-medium ${remaining === 1 ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"}`}>
          <span className="font-bold">{remaining}</span> resubmission{remaining !== 1 ? "s" : ""} left
        </span>
      )}
    </div>
  );
};

const PaperCard = ({ paper, onDelete, conferenceId }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded]           = useState(false);
  const [showDeleteModal, setShowDeleteModal]  = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus]      = useState(true);

  const paperId = paper.id || paper._id;

  useEffect(() => {
    if (!conferenceId || !paperId) return;
    setLoadingStatus(true);
    axios
      .get(`/api/author/conference/${conferenceId}/papers/${paperId}/submission-status`, getAuthHeaders())
      .then((res) => setSubmissionStatus(res.data?.data ?? null))
      .catch((err) => console.error("submission-status fetch failed:", err?.response?.status))
      .finally(() => setLoadingStatus(false));
  }, [conferenceId, paperId]);

  const finalDecision = (paper.final_decision || "").toLowerCase();
  const paperStatus   = (paper.status || "pending").toLowerCase();
  const isAssigned    = paperStatus === "assigned";
  const isModRequired = finalDecision === "modification required";
  const isRejected    = finalDecision === "rejected";
  const isAccepted    = finalDecision === "accepted";

  const effectiveStatus = isRejected ? "rejected" : isAccepted ? "accepted" : isModRequired ? "modification required" : paperStatus;

  const canResubmitByLimit = submissionStatus ? submissionStatus.canResubmit : true;
  const canEdit = !isRejected && !isAccepted && paperStatus !== "reviewed" && paperStatus !== "resubmitted" && (finalDecision === "" || finalDecision === "pending" || isModRequired);

  const handleEdit = () => {
    const url = `/userdashboard/update-paper?paperId=${paperId}` + (conferenceId ? `&conferenceId=${conferenceId}` : "") + (isModRequired ? "&resubmit=true" : "");
    navigate(url);
  };

  const effectiveStatusVariant = () => {
    switch (effectiveStatus) {
      case "accepted":              return "success";
      case "rejected":              return "destructive";
      case "modification required": return "warning";
      default:                      return statusVariant(effectiveStatus);
    }
  };

  const effectiveStatusLabel = () => {
    switch (effectiveStatus) {
      case "accepted":              return "Accepted";
      case "rejected":              return "Rejected";
      case "modification required": return "Modification Required";
      default:                      return statusLabel(effectiveStatus);
    }
  };

  const organizerComments = paper.organizer_comments_for_authors ?? paper.organizerCommentsForAuthors ?? null;
  const allComments = [];
  if (paper.reviews?.length > 0) {
    paper.reviews.forEach((review) => {
      if (review.comments_for_authors) allComments.push({ text: review.comments_for_authors, confidence: review.technical_confidence });
    });
  }
  if (organizerComments) allComments.push({ text: organizerComments, confidence: null });

  const validationInfo = paper.validationInfo ?? paper.validation_info ?? null;

  return (
    <>
      <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold leading-snug line-clamp-2">{paper.title}</CardTitle>
          {paper.manuscript_number && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Manuscript ID: {paper.manuscript_number}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {isRejected || isAccepted || isModRequired ? (
              <Badge variant={effectiveStatusVariant()}>{effectiveStatusLabel()}</Badge>
            ) : (
              <>
                <Badge variant={statusVariant(paperStatus)}>{statusLabel(paperStatus)}</Badge>
                {finalDecision && finalDecision !== "pending" && finalDecision !== "" && (
                  <Badge variant={decisionVariant(finalDecision)}>{decisionLabel(finalDecision)}</Badge>
                )}
              </>
            )}
          </div>
          {loadingStatus ? (
            <Skeleton className="h-5 w-36 rounded-md mt-2" />
          ) : (
            <ResubmissionCounter submissionStatus={submissionStatus} />
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3 flex-1">
          {paper.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {paper.keywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">{kw}</Badge>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Submitted:{" "}
            {paper.created_at
              ? new Date(paper.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
              : "--"}
          </p>

          {paper.paper_file_path && (
            <a href={paper.paper_file_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium w-fit">
              <ExternalLink className="h-3 w-3" />
              View Paper
            </a>
          )}

          {canEdit && (
            <div className="relative group flex gap-2 mt-auto pt-2">
              {isModRequired ? (
                <div className="relative group">
                  <Button variant="default" size="sm" disabled={isAssigned || !canResubmitByLimit} onClick={handleEdit} className="text-xs h-8">
                    <Pencil className="h-3 w-3 mr-1" />
                    Resubmit
                  </Button>
                  {!canResubmitByLimit && (
                    <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border text-popover-foreground p-2 rounded-md shadow-md opacity-0 group-hover:opacity-100 text-xs z-10 w-56 transition-opacity">
                      Resubmission limit reached for this paper.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button variant={isAssigned ? "outline" : "default"} size="sm" disabled={isAssigned} onClick={handleEdit} className="text-xs h-8">
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" disabled={isAssigned} onClick={() => !isAssigned && setShowDeleteModal(true)} className="text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </>
              )}
              {isAssigned && (
                <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border text-popover-foreground p-2 rounded-md shadow-md opacity-0 group-hover:opacity-100 text-xs z-10 w-56 transition-opacity">
                  This paper is currently under review and cannot be edited or deleted.
                </div>
              )}
            </div>
          )}

          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-1 w-fit">
            {isExpanded ? <><ChevronUp className="h-3 w-3" /> Less Details</> : <><ChevronDown className="h-3 w-3" /> More Details</>}
          </button>

          {isExpanded && (
            <div className="mt-2 pt-3 border-t border-border space-y-3 text-sm animate-fade-in">
              {paper.abstract && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Abstract</p>
                  <p className="text-foreground leading-relaxed text-xs">{paper.abstract}</p>
                </div>
              )}

              {paper.paper_authors?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Authors</p>
                  <ul className="space-y-1">
                    {paper.paper_authors.map((pa, i) => {
                      const author = pa.authors ?? pa;
                      const firstName = author?.first_name || author?.firstName || "";
                      const lastName  = author?.last_name  || author?.lastName  || "";
                      const email     = author?.email || "";
                      const isCorresponding = pa?.corresponding_author ?? false;
                      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown Author";
                      return (
                        <li key={i} className="text-xs text-foreground">
                          <span>{fullName}</span>
                          {isCorresponding && <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">Corresponding</Badge>}
                          {email && <span className="block text-muted-foreground">{email}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">PDF Validation</p>
                <ValidationBlock validationInfo={validationInfo} />
              </div>

              {allComments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Reviewer Comments</p>
                  <ul className="space-y-2">
                    {allComments.map((comment, i) => (
                      <li key={i} className="text-xs bg-muted rounded-md p-2 space-y-0.5">
                        {comment.confidence !== null && <p className="text-muted-foreground">Confidence: {comment.confidence}/10</p>}
                        <p className="text-foreground">{comment.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showDeleteModal && (
        <DeleteModal
          title={paper.title}
          onConfirm={() => { onDelete(paper.id || paper._id); setShowDeleteModal(false); }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
};

const PaperCardSkeleton = () => (
  <div className="rounded-xl border bg-card p-5 space-y-3">
    <Skeleton className="h-5 w-3/4" />
    <div className="flex gap-2">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
    <Skeleton className="h-5 w-36 rounded-md" />
    <Skeleton className="h-3 w-32" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
    <div className="flex gap-2 pt-2">
      <Skeleton className="h-8 w-16 rounded-md" />
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const AllPapersOfAuthor = () => {
  const [auth] = useAuth();
  const userId = auth?.user?._id || auth?.user?.id;
  const location = useLocation();

  const [conferences, setConferences]                   = useState([]);
  const [selectedConferenceId, setSelectedConferenceId] = useState("");
  const [selectedConferenceName, setSelectedConferenceName] = useState("");
  const [papers, setPapers]                             = useState([]);
  const [loadingConferences, setLoadingConferences]     = useState(false);
  const [loadingPapers, setLoadingPapers]               = useState(false);

  // ── Fetch conferences ────────────────────────────────────────────────────
  const fetchConferences = useCallback(async () => {
    if (!userId) return;
    setLoadingConferences(true);
    try {
      const res = await axios.get(`/api/author/${userId}/conferences`, getAuthHeaders());
      const fetched = res.data?.data?.conferences ?? [];
      setConferences(fetched);

      // Auto-select if only one conference (e.g. right after first submission)
      if (fetched.length === 1) {
        setSelectedConferenceId((prev) => prev || fetched[0].id);
        setSelectedConferenceName((prev) => prev || fetched[0].conference_name || fetched[0].name || "");
      }
    } catch (err) {
      console.error("Error fetching conferences:", err.response?.data);
      toast.error(err.response?.data?.message || "Unable to load conferences.");
    } finally {
      setLoadingConferences(false);
    }
  }, [userId]);

  // Re-fetch every time this page is navigated to (fixes post-submission stale list)
  useEffect(() => {
    fetchConferences();
  }, [fetchConferences, location.key]);

  // ── Fetch papers ─────────────────────────────────────────────────────────
  const fetchPapers = useCallback(async () => {
    if (!selectedConferenceId || !userId) return;
    setLoadingPapers(true);
    setPapers([]);
    try {
      const res = await axios.get(`/api/author/${userId}/${selectedConferenceId}/papers`, getAuthHeaders());
      const fetched = res.data?.data?.papers ?? [];
      setPapers(Array.isArray(fetched) ? fetched : []);
      if (fetched.length === 0) {
        toast("No papers submitted to this conference yet.", { icon: "📋" });
      }
    } catch (err) {
      console.error("Error fetching papers:", err.response?.data);
      if (err.response?.status === 401) {
        toast.error("Authentication failed. Please login again.");
      } else if (err.response?.status === 404) {
        setPapers([]);
      } else {
        toast.error(err.response?.data?.message || "Failed to load papers.");
      }
    } finally {
      setLoadingPapers(false);
    }
  }, [selectedConferenceId, userId]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (paperId) => {
    try {
      await axios.delete(`/api/author/delete-paper/${paperId}/${selectedConferenceId}`, getAuthHeaders());
      setPapers((prev) => prev.filter((p) => (p.id || p._id) !== paperId));
      toast.success("Paper deleted successfully.");
    } catch (err) {
      console.error("Delete error:", err.response?.data);
      toast.error(err.response?.data?.message || "Failed to delete the paper.");
    }
  };

  const handleConferenceChange = (value) => {
    const conf = conferences.find((c) => c.id === value);
    setSelectedConferenceId(value);
    setSelectedConferenceName(conf?.conference_name || conf?.name || "");
    setPapers([]);
  };

  return (
    <Layout title="PaperDesk - My Papers">
      <div className="flex-1 p-6 lg:p-10 overflow-auto bg-background">

        {/* ── Page header ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">My Papers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a conference to view your submissions
          </p>
        </div>

        {/* ── Conference selector ── */}
        <div className="max-w-sm mb-8">
          <label className="block text-sm font-medium text-foreground mb-2">Conference</label>
          {loadingConferences ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : (
            <Select value={selectedConferenceId} onValueChange={handleConferenceChange} disabled={!userId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={conferences.length === 0 ? "No conferences found" : "Select a conference"} />
              </SelectTrigger>
              <SelectContent>
                {conferences.map((conf) => (
                  <SelectItem key={conf.id} value={conf.id}>
                    {conf.conference_name || conf.name}
                    {conf.acronym ? ` (${conf.acronym})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Selected conference header ── */}
        {selectedConferenceName && (
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {selectedConferenceName}
              <span className="text-muted-foreground font-normal ml-1">— Submissions</span>
            </h2>
            {!loadingPapers && (
              <Badge variant="secondary" className="ml-auto">
                {papers.length} paper{papers.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loadingPapers && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <PaperCardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Papers grid ── */}
        {!loadingPapers && papers.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {papers.map((p) => (
              <PaperCard
                key={p.id || p._id}
                paper={p}
                onDelete={handleDelete}
                conferenceId={selectedConferenceId}
              />
            ))}
          </div>
        )}

        {/* ── Empty state: conference selected, no papers ── */}
        {!loadingPapers && selectedConferenceId && papers.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-24 gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">No papers have been submitted to this conference yet.</p>
          </div>
        )}

        {/* ── Empty state: no conference selected ── */}
        {!selectedConferenceId && !loadingConferences && (
          <div className="flex flex-col items-center justify-center mt-24 gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a conference above to view your papers.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllPapersOfAuthor;