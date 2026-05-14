import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

const DECISION_OPTIONS = [
  {
    value: "Accepted",
    label: "Accept Paper",
    icon: CheckCircle,
    border: "border-green-500",
    text: "text-green-700 dark:text-green-400",
    hover: "hover:bg-green-50 dark:hover:bg-green-950/40",
    selected: "bg-green-600 border-green-600 text-white hover:bg-green-600",
  },
  {
    value: "Rejected",
    label: "Reject Paper",
    icon: XCircle,
    border: "border-red-500",
    text: "text-red-700 dark:text-red-400",
    hover: "hover:bg-red-50 dark:hover:bg-red-950/40",
    selected: "bg-red-600 border-red-600 text-white hover:bg-red-600",
  },
  {
    value: "Modification Required",
    label: "Modifications Required",
    icon: AlertTriangle,
    border: "border-yellow-500",
    text: "text-yellow-700 dark:text-yellow-400",
    hover: "hover:bg-yellow-50 dark:hover:bg-yellow-950/40",
    selected: "bg-yellow-600 border-yellow-600 text-white hover:bg-yellow-600",
  },
];

const AssignPapersPage = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [availableReviewers, setAvailableReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState(["", "", ""]);
  const [plagiarismScore, setPlagiarismScore] = useState("");
  const [existingPlagiarismScore, setExistingPlagiarismScore] = useState(null);
  const [assignedReviewersCount, setAssignedReviewersCount] = useState(0);
  const [assignedReviewerIds, setAssignedReviewerIds] = useState([]);
  const [assignmentsByPaper, setAssignmentsByPaper] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("unassigned");
  const [modalMode, setModalMode] = useState("assign_reviewers");
  const [organizerDecision, setOrganizerDecision] = useState("");
  const [organizerCommentsForAuthors, setOrganizerCommentsForAuthors] = useState("");
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const getPaperId = (paper) => paper?.id || paper?._id || null;

  // ---------------------------------------------------------------------------
  // Core data fetching: papers + assignments
  // ---------------------------------------------------------------------------
  const fetchAllData = useCallback(async (silent = false) => {
    if (!conferenceId) return;
    if (!silent) setRefreshing(true);
    try {
      const res = await axios.get(`/api/conference/get-conference/${conferenceId}`);
      let fetchedPapers = null;
      if (res.data?.data?.papers) fetchedPapers = res.data.data.papers;
      else if (res.data?.papers) fetchedPapers = res.data.papers;
      else fetchedPapers = [];

      if (!fetchedPapers.length) {
        const papersRes = await axios.get(`/api/conference/${conferenceId}/papers`);
        fetchedPapers = papersRes.data?.papers || [];
      }
      setPapers(fetchedPapers);

      if (fetchedPapers.length) {
        const paperIds = fetchedPapers.map((p) => getPaperId(p)).filter(Boolean);
        if (paperIds.length) {
          const assignRes = await axios.post("/api/organizer/papers/assigned-reviewers", { paperIds });
          setAssignmentsByPaper(assignRes.data?.data || {});
        }
      }
    } catch (err) {
      console.error("Auto-refresh error:", err);
      if (!silent) toast.error("No Papers found for this conference.");
    } finally {
      if (!silent) setRefreshing(false);
      setLoadingPapers(false);
    }
  }, [conferenceId]);

  useEffect(() => {
    if (!conferenceId) return;
    fetchAllData(false);
    intervalRef.current = setInterval(() => {
      fetchAllData(true);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [conferenceId, fetchAllData]);

  const handleManualRefresh = () => {
    fetchAllData(false);
  };

  // ---------------------------------------------------------------------------
  // Modal handlers
  // ---------------------------------------------------------------------------
  const handleOpenModal = async (paper) => {
    const paperId = getPaperId(paper);
    if (!paperId) {
      toast.error("Cannot identify this paper. Please refresh and try again.");
      return;
    }

    setSelectedPaper(paper);
    setSelectedReviewers(["", "", ""]);
    setPlagiarismScore("");
    setOrganizerDecision("");
    setOrganizerCommentsForAuthors("");
    setModalMode("assign_reviewers");
    setExistingPlagiarismScore(paper.organizer_plagiarism_score ?? paper.plagiarism_score ?? null);
    setSubmitting(false);

    try {
      const [reviewersRes, assignmentsRes] = await Promise.all([
        axios.get(`/api/reviewer/${conferenceId}/reviewers`),
        axios.post("/api/organizer/papers/assigned-reviewers", { paperIds: [paperId] }),
      ]);
      setAvailableReviewers(reviewersRes.data?.data || []);
      const pa = assignmentsRes.data?.data?.[paperId];
      setAssignedReviewerIds((pa?.reviewers || []).map((r) => r.reviewerId));
      setAssignedReviewersCount(pa?.assignedCount || 0);
    } catch (error) {
      console.error("Modal data fetch error:", error);
      toast.error("Failed to load reviewer data.");
      setSelectedPaper(null);
    }
  };

  const handleReviewerSelect = (slotIndex, value) => {
    setSelectedReviewers((prev) => {
      const updated = [...prev];
      updated[slotIndex] = value;
      return updated;
    });
  };

  const getExcludedIds = (slotIndex) => {
    const otherSlots = selectedReviewers.filter((_, i) => i !== slotIndex).filter((r) => r !== "");
    return [...assignedReviewerIds, ...otherSlots];
  };

  const handleModeChange = (mode) => {
    setModalMode(mode);
    setOrganizerDecision("");
    setOrganizerCommentsForAuthors("");
    setSelectedReviewers(["", "", ""]);
  };

  const handleSubmit = async () => {
    const paperId = getPaperId(selectedPaper);
    if (!paperId) {
      toast.error("Paper ID missing.");
      return;
    }

    if (!existingPlagiarismScore) {
      const raw = plagiarismScore.toString().trim();
      const parsed = parseFloat(raw);
      if (raw === "" || isNaN(parsed) || parsed < 0 || parsed > 100) {
        toast.error("Enter a valid plagiarism score (0-100).");
        return;
      }
    }

    setSubmitting(true);

    try {
      // -----------------------------------------------------------------------
      // Mode A: Assign Reviewers
      // -----------------------------------------------------------------------
      if (modalMode === "assign_reviewers") {
        const chosenIds = selectedReviewers.slice(0, 3 - assignedReviewersCount).filter((r) => r !== "");
        if (chosenIds.length === 0) {
          toast.error("Please select at least one reviewer.");
          setSubmitting(false);
          return;
        }

        const body = { paperId, reviewerIds: chosenIds, conferenceId };
        if (!existingPlagiarismScore) body.plagiarismScore = parseFloat(plagiarismScore);

        const res = await axios.post("/api/organizer/assign-paper-manual", body);
        if (res.data.success) {
          if (res.data.alreadyAssigned) {
            toast("All selected reviewers were already assigned.", { icon: "i" });
          } else {
            toast.success(res.data.message);
            fetchAllData(false);
          }
          setSelectedPaper(null);
        } else {
          toast.error(res.data.error || "Reviewer assignment failed.");
        }
      }

      // -----------------------------------------------------------------------
      // Mode B: Review Myself — plagiarism score is sent WITH the decision.
      // The updateFinalDecisionController already handles saving it atomically.
      // -----------------------------------------------------------------------
      if (modalMode === "give_decision") {
        if (!organizerDecision) {
          toast.error("Please select a decision.");
          setSubmitting(false);
          return;
        }

        const decisionPayload = {
          paperId,
          decision: organizerDecision,
          commentsForAuthors: organizerCommentsForAuthors,
        };

        // Only include plagiarismScore when it hasn't been recorded yet
        if (!existingPlagiarismScore) {
          decisionPayload.plagiarismScore = parseFloat(plagiarismScore);
        }

        const decRes = await axios.post("/api/organizer/update-decision", decisionPayload);

        const decisionSaved =
          decRes.data.success === true ||
          (decRes.status >= 200 && decRes.status < 300 && !decRes.data.error);

        if (decisionSaved) {
          toast.success(`Decision "${organizerDecision}" recorded.`);
          fetchAllData(false);
          setSelectedPaper(null);
        } else {
          toast.error(decRes.data.message || decRes.data.error || "Failed to save decision.");
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.response?.data?.error || err.response?.data?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived states and filtering
  // ---------------------------------------------------------------------------
  const plagiarismSatisfied =
    existingPlagiarismScore !== null && existingPlagiarismScore !== undefined;

  const plagiarismInputValid = (() => {
    if (plagiarismSatisfied) return true;
    const parsed = parseFloat(plagiarismScore);
    return (
      plagiarismScore.toString().trim() !== "" &&
      !isNaN(parsed) &&
      parsed >= 0 &&
      parsed <= 100
    );
  })();

  const slotsAvailable = 3 - assignedReviewersCount;
  const atLeastOneReviewerChosen = selectedReviewers.slice(0, slotsAvailable).some((r) => r !== "");

  const canSubmit = (() => {
    if (submitting || !plagiarismInputValid) return false;
    if (modalMode === "assign_reviewers") return atLeastOneReviewerChosen;
    if (modalMode === "give_decision") return organizerDecision !== "";
    return false;
  })();

  const hasFinalDecision = (paper) => {
    const decision = paper.decision || paper.final_decision;
    if (decision === "Accepted") return true;
    if (decision === "Rejected") return true;
    if (decision === "Modification Required" && paper.status !== "resubmitted") return true;
    return false;
  };

  const unassignedPapers = papers.filter((paper) => {
    if (hasFinalDecision(paper)) return false;
    const pid = getPaperId(paper);
    const assignedCount = assignmentsByPaper[pid]?.assignedCount || 0;
    return assignedCount === 0;
  });

  const assignedPapers = papers.filter((paper) => {
    if (hasFinalDecision(paper)) return false;
    const pid = getPaperId(paper);
    const assignedCount = assignmentsByPaper[pid]?.assignedCount || 0;
    return assignedCount >= 1;
  });

  // ---------------------------------------------------------------------------
  // Table renderer
  // ---------------------------------------------------------------------------
  const renderPapersTable = (papersList) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40 dark:bg-muted/20">
            {["#", "Title", "Keywords", "Authors", "Submitted", "Status", "Plagiarism %", "Assigned", "Paper", "Action"].map((h) => (
              <th
                key={h}
                className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {papersList.length > 0 ? (
            papersList.map((paper, i) => {
              const pid = getPaperId(paper);
              const assignedCount = assignmentsByPaper[pid]?.assignedCount || 0;
              const isFull = assignedCount >= 3;
              const displayPlagScore = paper.organizer_plagiarism_score ?? paper.plagiarism_score;
              const hasPlagScore =
                displayPlagScore !== null && displayPlagScore !== undefined;
              return (
                <tr key={pid || i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 text-sm">{i + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium">{paper.title}</td>
                  <td className="px-6 py-4 text-sm">{paper.keywords?.join(", ") || "-"}</td>
                  <td className="px-6 py-4 text-sm">
                    {paper.paper_authors?.map((pa, idx) => (
                      <div key={idx}>
                        {pa.authors?.first_name} ({pa.authors?.email})
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {paper.created_at ? new Date(paper.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Badge
                      variant={
                        paper.status === "resubmitted"
                          ? "info"
                          : paper.status === "assigned"
                          ? "default"
                          : "warning"
                      }
                    >
                      {paper.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {hasPlagScore ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {displayPlagScore}%
                      </span>
                    ) : (
                      <span className="text-red-500 text-xs font-semibold">Required</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Badge variant={isFull ? "success" : "warning"}>{assignedCount}/3</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {paper.paper_file_path ? (
                      <a
                        href={paper.paper_file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" /> View PDF
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isFull ? (
                      <span className="text-muted-foreground text-sm">Full</span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenModal(paper)}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        Assign / Review
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={10} className="text-center py-8 text-muted-foreground">
                No papers in this category.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout title="ConForum - Assign Papers">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-1">
                    {conferenceName || "Conference"}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage paper assignments and reviews. Papers are organised by assignment status.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <CardContent className="p-0">
              <Tabs
                defaultValue="unassigned"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="border-b border-border px-6 pt-4">
                  <TabsList className="bg-transparent">
                    <TabsTrigger
                      value="unassigned"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:rounded-none px-4"
                    >
                      <span className="flex items-center gap-2">
                        Unassigned Papers
                        <Badge variant="secondary" className="ml-1">
                          {unassignedPapers.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="assigned"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:rounded-none px-4"
                    >
                      <span className="flex items-center gap-2">
                        Assigned Papers
                        <Badge variant="secondary" className="ml-1">
                          {assignedPapers.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="unassigned" className="mt-0">
                  {loadingPapers ? (
                    <div className="p-6 text-center text-muted-foreground">Loading papers...</div>
                  ) : (
                    renderPapersTable(unassignedPapers)
                  )}
                </TabsContent>
                <TabsContent value="assigned" className="mt-0">
                  {loadingPapers ? (
                    <div className="p-6 text-center text-muted-foreground">Loading papers...</div>
                  ) : (
                    renderPapersTable(assignedPapers)
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* -----------------------------------------------------------------------
          Modal
      ----------------------------------------------------------------------- */}
      {selectedPaper && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-lg w-full border border-border max-h-[92vh] flex flex-col">
            {/* Modal header */}
            <div className="flex justify-between items-start px-6 py-4 border-b border-border flex-shrink-0">
              <div className="pr-4">
                <h2 className="text-lg font-semibold text-foreground">Paper Action</h2>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {selectedPaper.title}
                </p>
                {selectedPaper.status === "resubmitted" && (
                  <Badge variant="info" className="mt-1">
                    Resubmission
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setSelectedPaper(null)}
                className="text-muted-foreground hover:text-foreground transition text-lg leading-none flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
              {/* Step 1: Plagiarism */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StepCircle number={1} active />
                  <span className="text-sm font-medium text-foreground">
                    Plagiarism Check Percentage{" "}
                    {plagiarismSatisfied ? (
                      <span className="text-green-600 dark:text-green-400 font-normal">
                        (recorded: {existingPlagiarismScore}%)
                      </span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </span>
                </div>
                {plagiarismSatisfied ? (
                  <div className="px-3 py-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-700 dark:text-green-300">
                    Already recorded — proceed below.
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={plagiarismScore}
                      onChange={(e) => setPlagiarismScore(e.target.value)}
                      placeholder="Enter plagiarism % (0–100)"
                      className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      disabled={submitting}
                    />
                    {plagiarismScore !== "" && !plagiarismInputValid && (
                      <p className="text-xs text-red-500 mt-1">Must be between 0 and 100.</p>
                    )}
                    {!plagiarismInputValid && (
                      <p className="text-xs text-amber-600 mt-1">
                        Step 2 is locked until a valid score is entered.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Step 2: Mode selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <StepCircle number={2} active={plagiarismInputValid} />
                  <span
                    className={`text-sm font-medium ${
                      plagiarismInputValid ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    What would you like to do?
                  </span>
                </div>
                {!plagiarismInputValid ? (
                  <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    Enter a valid plagiarism score above to unlock this section.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <ModeCard
                      active={modalMode === "assign_reviewers"}
                      onClick={() => handleModeChange("assign_reviewers")}
                      icon={Users}
                      title="Assign Reviewers"
                      description="Send to reviewers for evaluation."
                      disabled={submitting}
                    />
                    <ModeCard
                      active={modalMode === "give_decision"}
                      onClick={() => handleModeChange("give_decision")}
                      icon={ClipboardList}
                      title="Review Myself"
                      description="Skip reviewers, give decision now."
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>

              {/* Mode A: Assign Reviewers */}
              {plagiarismInputValid && modalMode === "assign_reviewers" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {slotsAvailable} slot{slotsAvailable !== 1 ? "s" : ""} available — Currently
                    assigned: {assignedReviewersCount}/3
                  </p>
                  {Array.from({ length: Math.min(slotsAvailable, 3) }).map((_, slotIndex) => {
                    const excludedIds = getExcludedIds(slotIndex);
                    return (
                      <select
                        key={slotIndex}
                        value={selectedReviewers[slotIndex] || ""}
                        onChange={(e) => handleReviewerSelect(slotIndex, e.target.value)}
                        disabled={submitting}
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">-- Reviewer {slotIndex + 1} (optional) --</option>
                        {availableReviewers.map((r) => (
                          <option
                            key={r.user_id}
                            value={r.user_id}
                            disabled={excludedIds.includes(r.user_id)}
                          >
                            {r.users?.name} ({r.users?.email})
                            {assignedReviewerIds.includes(r.user_id) ? " (Already assigned)" : ""}
                          </option>
                        ))}
                      </select>
                    );
                  })}
                  {!atLeastOneReviewerChosen && (
                    <p className="text-xs text-amber-600">
                      Select at least one reviewer to proceed.
                    </p>
                  )}
                </div>
              )}

              {/* Mode B: Review Myself */}
              {plagiarismInputValid && modalMode === "give_decision" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Select your verdict. The paper will be removed from this table and appear in{" "}
                    <strong>Review Management</strong> with your decision recorded.
                  </p>
                  {DECISION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = organizerDecision === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={submitting}
                        onClick={() => setOrganizerDecision(opt.value)}
                        className={`w-full flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm font-medium transition-all ${
                          isSelected
                            ? opt.selected
                            : `${opt.border} ${opt.text} ${opt.hover}`
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {opt.label}
                        {isSelected && (
                          <span className="ml-auto text-xs font-normal opacity-80">Selected</span>
                        )}
                      </button>
                    );
                  })}

                  <div className="space-y-2 mt-4">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Comments for Authors (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={organizerCommentsForAuthors}
                      onChange={(e) => setOrganizerCommentsForAuthors(e.target.value)}
                      placeholder="Provide feedback for the authors (optional)..."
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal-500"
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setSelectedPaper(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submitting
                  ? "Submitting..."
                  : modalMode === "give_decision"
                  ? "Submit Decision"
                  : "Assign Reviewers"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
const StepCircle = ({ number, active }) => (
  <span
    className={`flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold flex-shrink-0 transition-colors ${
      active ? "bg-teal-600" : "bg-gray-400"
    }`}
  >
    {number}
  </span>
);

const ModeCard = ({ active, onClick, icon: Icon, title, description, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all ${
      active
        ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30"
        : "border-border hover:border-teal-400 hover:bg-muted/40"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <div className="flex items-center gap-2">
      <span
        className={`flex items-center justify-center w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
          active ? "border-teal-600 bg-teal-600" : "border-muted-foreground"
        }`}
      >
        {active && (
          <svg
            className="w-2.5 h-2.5 text-white"
            fill="none"
            viewBox="0 0 12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2,6 5,9 10,3" />
          </svg>
        )}
      </span>
      <Icon className={`h-4 w-4 ${active ? "text-teal-600" : "text-muted-foreground"}`} />
      <span
        className={`text-sm font-semibold ${
          active ? "text-teal-700 dark:text-teal-400" : "text-foreground"
        }`}
      >
        {title}
      </span>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed pl-6">{description}</p>
  </button>
);

export default AssignPapersPage;