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

const COMPLIANCE_BLOCK_THRESHOLD = 40;
const COMPLIANCE_WARN_THRESHOLD  = 60;

const getComplianceColor = (pct) => {
  if (pct < COMPLIANCE_BLOCK_THRESHOLD) return "red";
  if (pct < COMPLIANCE_WARN_THRESHOLD)  return "yellow";
  return "green";
};

const complianceColorMap = {
  red: {
    wrapper: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    badge:   "bg-red-600 text-white",
    banner:  "bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200",
  },
  yellow: {
    wrapper: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    badge:   "bg-yellow-500 text-white",
    banner:  "bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
  },
  green: {
    wrapper: "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-800",
    badge:   "bg-green-600 text-white",
    banner:  null,
  },
};

const getRuleStyle = (detail) => {
  if (detail.rule === "Author Anonymity" && detail.severity === "error") {
    return {
      text:        "text-red-900 dark:text-red-100",
      messageText: "text-red-800 dark:text-red-200",
      suggestion:  "text-red-700 dark:text-red-300",
      bg:          "bg-red-100 dark:bg-red-950/50 border border-red-400 dark:border-red-700 p-3 rounded-lg",
    };
  }
  if (detail.severity === "warning") {
    return {
      text:        "text-yellow-900 dark:text-yellow-100",
      messageText: "text-yellow-800 dark:text-yellow-200",
      suggestion:  "text-yellow-700 dark:text-yellow-300",
      bg:          "bg-yellow-100 dark:bg-yellow-950/50 border border-yellow-300 dark:border-yellow-700 p-3 rounded-lg",
    };
  }
  return {
    text:        "text-foreground",
    messageText: "text-muted-foreground",
    suggestion:  "text-primary",
    bg:          "bg-muted/20 border border-border p-3 rounded-lg",
  };
};

const UpdatePaper = () => {
  const navigate    = useNavigate();
  const [auth]      = useAuth();
  const { search }  = useLocation();
  const queryParams = new URLSearchParams(search);
  const paperId       = queryParams.get("paperId");
  const conferenceId  = queryParams.get("conferenceId");
  const isResubmit    = queryParams.get("resubmit") === "true";

  const fileInputRef = useRef(null);
  const [selectedFile,      setSelectedFile]      = useState(null);
  const [complianceReport,  setComplianceReport]  = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [showModal,         setShowModal]         = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [submissionStatus,  setSubmissionStatus]  = useState(null);

  const [paperDetails, setPaperDetails] = useState({
    title: "", abstract: "", keywords: "",
    conferenceName: "", conferenceAcronym: "", authors: [], file: null,
  });
  const [initialPaperDetails, setInitialPaperDetails] = useState({
    title: "", abstract: "", keywords: "",
    conferenceName: "", conferenceAcronym: "", authors: [], file: null,
  });

  const isBlocked =
    complianceReport !== null &&
    complianceReport.percentage < COMPLIANCE_BLOCK_THRESHOLD;

  const limitReached = isResubmit && submissionStatus !== null && submissionStatus.canResubmit === false;

  // Fetch resubmission limit info (only for resubmit flow)
  useEffect(() => {
    if (!isResubmit || !conferenceId || !paperId) return;
    axios
      .get(`/api/author/conference/${conferenceId}/papers/${paperId}/submission-status`)
      .then((res) => {
        //  Response shape: { success: true, data: { unlimited, canResubmit, ... } }
        setSubmissionStatus(res.data?.data ?? null);
      })
      .catch(() => {});
  }, [isResubmit, conferenceId, paperId]);

  // Fetch existing paper details
  useEffect(() => {
    if (!paperId) return;
    const fetchPaperDetails = async () => {
      try {
        const response = await axios.get(`/api/author/research-paper/${paperId}`);
        //  Response shape: { success: true, data: { ... } }
        const data = response.data?.data || {};
        const details = {
          title:             data.title             || "",
          abstract:          data.abstract          || "",
          keywords:          data.keywords?.join(", ") || "",
          conferenceName:    data.conferenceName    || "",
          conferenceAcronym: data.conferenceAcronym || "",
          authors:           data.authors           || [],
          file:              data.file              || null,
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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    setPaperDetails((prev) => ({ ...prev, file }));
    setComplianceReport(null);
    setComplianceLoading(true);
    try {
      const formData = new FormData();
      formData.append("paper", file);
      const response = await axios.post("/api/author/check-compliance", formData);
      //  Response shape: { success: true, data: { complianceReport } }
      const report = response.data?.data?.complianceReport || null;
      setComplianceReport(report);
      if (report && report.percentage < COMPLIANCE_BLOCK_THRESHOLD) {
        toast.error(`Compliance score ${report.percentage}% is below the minimum 40%.`);
      } else {
        toast.success("Compliance check completed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error performing compliance check.");
    } finally {
      setComplianceLoading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPaperDetails((prev) => ({ ...prev, file: null }));
    setComplianceReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getChangedData = () => {
    const changedData = {};
    if (paperDetails.title             !== initialPaperDetails.title)             changedData.title             = paperDetails.title;
    if (paperDetails.abstract          !== initialPaperDetails.abstract)          changedData.abstract          = paperDetails.abstract;
    if (paperDetails.keywords          !== initialPaperDetails.keywords)          changedData.keywords          = paperDetails.keywords;
    if (paperDetails.conferenceName    !== initialPaperDetails.conferenceName)    changedData.conferenceName    = paperDetails.conferenceName;
    if (paperDetails.conferenceAcronym !== initialPaperDetails.conferenceAcronym) changedData.conferenceAcronym = paperDetails.conferenceAcronym;
    if (JSON.stringify(paperDetails.authors) !== JSON.stringify(initialPaperDetails.authors)) changedData.authors = paperDetails.authors;
    if (paperDetails.file !== initialPaperDetails.file) changedData.file = paperDetails.file;
    return changedData;
  };

  const doSubmit = async () => {
    setLoading(true);
    const changedData = getChangedData();
    if (Object.keys(changedData).length === 0) {
      toast.info("No changes detected.");
      setLoading(false);
      return;
    }
    const formData = new FormData();
    Object.entries(changedData).forEach(([key, value]) => {
      if (key === "authors") formData.append(key, JSON.stringify(value));
      else if (key === "file") formData.append("paper", value);
      else formData.append(key, value);
    });
    formData.append("userId",     auth?.user?._id || auth?.user?.id);
    formData.append("isResubmit", isResubmit);
    try {
      await axios.put(`/api/author/update-paper-details/${paperId}`, formData);
      toast.success("Paper updated successfully!");
      navigate("/userdashboard/author-dashboard");
    } catch (err) {
      toast.error("Error updating paper");
      console.error("Update Error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (limitReached) {
      toast.error("Resubmission limit reached. You cannot submit any more revisions for this paper.");
      return;
    }
    if (isResubmit && !selectedFile) {
      toast.error("Please upload your revised manuscript before resubmitting.");
      return;
    }
    if (isBlocked) {
      toast.error(`Score ${complianceReport.percentage}% is below minimum ${COMPLIANCE_BLOCK_THRESHOLD}%.`);
      return;
    }
    if (
      complianceReport &&
      complianceReport.percentage >= COMPLIANCE_BLOCK_THRESHOLD &&
      complianceReport.percentage < COMPLIANCE_WARN_THRESHOLD
    ) {
      setShowModal(true);
      return;
    }
    await doSubmit();
  };

  const colour  = complianceReport ? getComplianceColor(complianceReport.percentage) : "green";
  const colours = complianceColorMap[colour];

  if (!paperId) {
    return (
      <Layout title="ConForum - Update Paper">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-destructive">No paper ID provided.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isResubmit ? "ConForum - Resubmit Paper" : "ConForum - Update Paper"}>
      <div className="flex-1 overflow-auto bg-background">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-10 py-10">

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

          {limitReached && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Resubmission limit reached</p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  You have used all {submissionStatus.maxResubmissions} resubmission{submissionStatus.maxResubmissions !== 1 ? "s" : ""} allowed by the organizer for this paper. No further resubmissions can be made.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* LEFT COLUMN */}
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
                      <p className="text-xs text-muted-foreground">Separate with commas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col gap-6">
                <Card className="flex-1">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Manuscript Upload
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    <div
                      className={`relative group border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                        isBlocked
                          ? "border-destructive/50 bg-destructive/5"
                          : selectedFile
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
                            isBlocked
                              ? "bg-destructive/10 text-destructive"
                              : selectedFile
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}
                        >
                          {isBlocked ? (
                            <XCircle className="w-7 h-7" />
                          ) : selectedFile ? (
                            <CheckCircle className="w-7 h-7" />
                          ) : (
                            <Upload className="w-7 h-7" />
                          )}
                        </div>

                        {selectedFile ? (
                          <div>
                            <p className={`text-sm font-bold truncate max-w-xs mx-auto ${
                              isBlocked ? "text-destructive" : "text-green-600 dark:text-green-400"
                            }`}>
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
                              IEEE format preferred · Max 10 MB
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
                          Remove & replace
                        </Button>
                      </div>
                    )}

                    {complianceLoading && (
                      <div className="flex items-center justify-center gap-2 text-primary text-xs font-semibold py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validating IEEE compliance…
                      </div>
                    )}

                    {complianceReport && (
                      <div className={`rounded-xl p-5 border ${colours.wrapper}`}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-sm font-bold text-foreground">Compliance Audit</h3>
                          <Badge className={`text-xs ${colours.badge}`}>
                            {complianceReport.percentage}% Score
                          </Badge>
                        </div>

                        {colour === "red" && colours.banner && (
                          <div className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${colours.banner}`}>
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            Submission blocked — score below {COMPLIANCE_BLOCK_THRESHOLD}%. Fix issues and re-upload.
                          </div>
                        )}

                        {colour === "yellow" && colours.banner && (
                          <div className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${colours.banner}`}>
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            Low score — you may still submit but improving it is recommended.
                          </div>
                        )}

                        <ul className="space-y-2">
                          {complianceReport.details.map((detail, index) => {
                            const style = getRuleStyle(detail);
                            return (
                              <li key={index} className={style.bg}>
                                <p className={`text-xs font-bold ${style.text}`}>{detail.rule}</p>
                                <p className={`text-xs ${style.messageText}`}>{detail.message}</p>
                                {detail.suggestion && (
                                  <p className={`text-xs font-semibold mt-0.5 italic ${style.suggestion}`}>
                                    Suggest: {detail.suggestion}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={loading || isBlocked || complianceLoading || limitReached}
                    size="lg"
                    className="w-full font-bold text-sm h-12"
                    variant={isBlocked || limitReached ? "destructive" : "default"}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving changes…</>
                    ) : limitReached ? (
                      "Resubmission Limit Reached"
                    ) : isBlocked ? (
                      `Blocked — score too low (${complianceReport?.percentage}%)`
                    ) : isResubmit ? (
                      "Resubmit Paper"
                    ) : (
                      "Save Changes"
                    )}
                  </Button>

                  {isBlocked && !limitReached && (
                    <p className="text-center text-xs text-destructive font-medium">
                      Minimum {COMPLIANCE_BLOCK_THRESHOLD}% IEEE compliance required.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Warning modal (yellow zone) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Low Compliance Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Score: {complianceReport?.percentage}%</p>
                  <p className="text-xs text-muted-foreground">Below recommended 60% threshold</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your paper meets the minimum requirement but improving the IEEE compliance
                score may increase your chances of acceptance.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Go back & fix
                </Button>
                <Button
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={async () => { setShowModal(false); await doSubmit(); }}
                >
                  Submit anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default UpdatePaper;