import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Loader2,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
} from "lucide-react";

const UpdatePaper = () => {
  const navigate = useNavigate();
  const [auth] = useAuth();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const paperId = queryParams.get("paperId");
  const conferenceId = queryParams.get("conferenceId");
  const isResubmit = queryParams.get("resubmit") === "true";

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const [paperDetails, setPaperDetails] = useState({
    title: "",
    abstract: "",
    keywords: "",
    conferenceName: "",
    conferenceAcronym: "",
  });
  const [initialPaperDetails, setInitialPaperDetails] = useState({
    title: "",
    abstract: "",
    keywords: "",
    conferenceName: "",
    conferenceAcronym: "",
  });

  const limitReached =
    isResubmit &&
    submissionStatus !== null &&
    submissionStatus.canResubmit === false;

  // ── Fetch resubmission limit info (only for resubmit flow) ─────────────────
  useEffect(() => {
    if (!isResubmit || !conferenceId || !paperId) return;
    axios
      .get(
        `/api/author/conference/${conferenceId}/papers/${paperId}/submission-status`
      )
      .then((res) => {
        setSubmissionStatus(res.data?.data ?? null);
      })
      .catch(() => {});
  }, [isResubmit, conferenceId, paperId]);

  // ── Fetch existing paper details ────────────────────────────────────────────
  useEffect(() => {
    if (!paperId) return;
    const fetchPaperDetails = async () => {
      try {
        const response = await axios.get(
          `/api/author/research-paper/${paperId}`
        );
        // Backend returns: { success, data: { paper: { ... } } }
        const data = response.data?.data?.paper || {};

        // Handle keywords as array or string consistently
        const keywordsValue = Array.isArray(data.keywords)
          ? data.keywords.join(", ")
          : typeof data.keywords === "string"
          ? data.keywords
          : "";

        const details = {
          title: data.title || "",
          abstract: data.abstract || "",
          keywords: keywordsValue,
          conferenceName: data.conference_name || "",
          conferenceAcronym: data.conference_acronym || "",
        };
        setPaperDetails(details);
        setInitialPaperDetails(details);
      } catch (err) {
        setError("Failed to fetch paper details");
        console.error(err);
      }
    };
    fetchPaperDetails();
  }, [paperId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPaperDetails((prev) => ({ ...prev, [name]: value }));
  };

  // Select PDF file directly — no compliance check call.
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Build only changed fields for the payload ───────────────────────────────
  const getChangedData = () => {
    const changedData = {};
    if (paperDetails.title !== initialPaperDetails.title)
      changedData.title = paperDetails.title;
    if (paperDetails.abstract !== initialPaperDetails.abstract)
      changedData.abstract = paperDetails.abstract;
    if (paperDetails.keywords !== initialPaperDetails.keywords)
      changedData.keywords = paperDetails.keywords;
    // file tracked separately via selectedFile
    if (selectedFile) changedData.file = selectedFile;
    return changedData;
  };

  // ── Actual submit to backend ────────────────────────────────────────────────
  const doSubmit = async () => {
    setLoading(true);
    const changedData = getChangedData();

    // Check both changedData AND selectedFile for any changes
    if (
      !isResubmit &&
      Object.keys(changedData).length === 0 &&
      !selectedFile
    ) {
      toast.error("No changes to save.");
      setLoading(false);
      return;
    }

    // Resubmit requires a new file
    if (isResubmit && !selectedFile) {
      toast.error("Please upload your revised manuscript before resubmitting.");
      setLoading(false);
      return;
    }

    const formData = new FormData();

    // Append changed text fields
    if (changedData.title) formData.append("title", changedData.title);
    if (changedData.abstract)
      formData.append("abstract", changedData.abstract);
    if (changedData.keywords) formData.append("keywords", changedData.keywords);

    // Append file — backend multer expects field name "paper"
    if (changedData.file) formData.append("paper", changedData.file);

    // Always send userId and isResubmit as string (backend checks === "true")
    formData.append("userId", auth?.user?._id || auth?.user?.id || "");
    formData.append("isResubmit", isResubmit ? "true" : "false");

    try {
      await axios.put(
        `/api/author/update-paper-details/${paperId}`,
        formData
      );
      toast.success(
        isResubmit
          ? "Paper resubmitted successfully!"
          : "Paper updated successfully!"
      );
      navigate("/userdashboard/papers");
    } catch (err) {
      const msg = err.response?.data?.message || "Error updating paper";
      toast.error(msg);
      console.error("Update Error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Form submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (limitReached) {
      toast.error(
        "Resubmission limit reached. You cannot submit any more revisions for this paper."
      );
      return;
    }

    // Resubmit requires a new file
    if (isResubmit && !selectedFile) {
      toast.error("Please upload your revised manuscript before resubmitting.");
      return;
    }

    await doSubmit();
  };

  if (!paperId) {
    return (
      <Layout title="PaperDesk - Update Paper">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-destructive">No paper ID provided.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={
        isResubmit ? "PaperDesk - Resubmit Paper" : "PaperDesk - Update Paper"
      }
    >
      <div className="flex-1 overflow-auto bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-10 py-10">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-1 rounded-full bg-primary" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                {isResubmit ? "Resubmit Paper" : "Edit Paper"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-4">
              {isResubmit
                ? "Address reviewer feedback and upload your revised manuscript."
                : "Update your paper details and optionally replace the PDF."}
            </p>
          </div>

          {/* Resubmission limit banner */}
          {limitReached && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  Resubmission limit reached
                </p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  You have used all{" "}
                  {submissionStatus.maxResubmissions} resubmission
                  {submissionStatus.maxResubmissions !== 1 ? "s" : ""} allowed by
                  the organizer for this paper. No further resubmissions can be
                  made.
                </p>
              </div>
            </div>
          )}

          {/* Resubmission count info banner */}
          {isResubmit && submissionStatus && !limitReached && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Resubmission {submissionStatus.currentCount + 1}
                  {submissionStatus.unlimited
                    ? ""
                    : ` of ${submissionStatus.maxResubmissions}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {submissionStatus.unlimited
                    ? "This conference has no resubmission limit."
                    : `You have ${
                        submissionStatus.maxResubmissions -
                        submissionStatus.currentCount
                      } resubmission${
                        submissionStatus.maxResubmissions -
                          submissionStatus.currentCount !==
                        1
                          ? "s"
                          : ""
                      } remaining after this one.`}
                </p>
              </div>
            </div>
          )}

          {/* Fetch error */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* ── LEFT COLUMN: Paper details ── */}
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Paper Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-foreground">
                        Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        name="title"
                        value={paperDetails.title}
                        onChange={handleChange}
                        placeholder="Full title of your research paper"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-foreground">
                        Abstract <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        name="abstract"
                        rows={7}
                        value={paperDetails.abstract}
                        onChange={handleChange}
                        placeholder="Concise summary of your research"
                        required
                        className="resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-foreground">
                        Keywords <span className="text-destructive">*</span>
                      </label>
                      <Input
                        name="keywords"
                        value={paperDetails.keywords}
                        onChange={handleChange}
                        placeholder="e.g. AI, Deep Learning, Cloud Computing"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate with commas
                      </p>
                    </div>

                    {/* Read-only conference info */}
                    {paperDetails.conferenceName && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-foreground">
                          Conference
                        </label>
                        <Input
                          value={`${paperDetails.conferenceName} (${paperDetails.conferenceAcronym})`}
                          disabled
                          className="opacity-60 cursor-not-allowed"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── RIGHT COLUMN: File upload ── */}
              <div className="flex flex-col gap-6">
                <Card className="flex-1">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Manuscript Upload
                      {isResubmit && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Required for resubmit
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    {/* Drop zone */}
                    <div
                      className={`relative group border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                        selectedFile
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-primary hover:bg-muted/20"
                      }`}
                    >
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        ref={fileInputRef}
                      />
                      <div className="space-y-3 pointer-events-none">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto transition-colors ${
                            selectedFile
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}
                        >
                          {selectedFile ? (
                            <CheckCircle className="w-7 h-7" />
                          ) : (
                            <Upload className="w-7 h-7" />
                          )}
                        </div>

                        {selectedFile ? (
                          <div>
                            <p className="text-sm font-bold truncate max-w-xs mx-auto text-green-600 dark:text-green-400">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Click to upload PDF
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              IEEE format preferred
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedFile && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeFile}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Remove &amp; replace
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submit button */}
                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={loading || limitReached}
                    size="lg"
                    className="w-full font-bold text-sm h-12"
                    variant={limitReached ? "destructive" : "default"}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving changes…
                      </>
                    ) : limitReached ? (
                      "Resubmission Limit Reached"
                    ) : isResubmit ? (
                      "Resubmit Paper"
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default UpdatePaper;