import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

const ReviewForm = () => {
  const [formData, setFormData] = useState({
    originality: 1,
    technicalQuality: 1,
    significance: 1,
    clarity: 1,
    relevance: 1,
    overallRecommendation: "",
    commentsForAuthors: "",
    commentsForOrganizers: "",
  });

  const [paper, setPaper] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [title, setTitle] = useState("");
  const [plagiarismScore, setPlagiarismScore] = useState(null);
  const [plagiarismLoading, setPlagiarismLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const reviewerId = queryParams.get("reviewerId") || "";
    const paperId = queryParams.get("paperId") || "";
    const paperTitle = queryParams.get("title") || "";
    setPaper(paperId);
    setReviewer(reviewerId);
    setTitle(paperTitle);
    if (paperId) fetchPlagiarismScore(paperId);
  }, [location.search]);

  const fetchPlagiarismScore = async (paperId) => {
    setPlagiarismLoading(true);
    try {
      const response = await axios.get(`/api/author/research-paper/${paperId}`);
      const paperData = response.data?.data || response.data;
      const score = paperData?.organizer_plagiarism_score;
      setPlagiarismScore(score !== undefined ? score : null);
    } catch (error) {
      console.error("Failed to fetch plagiarism score:", error);
      setPlagiarismScore(null);
    } finally {
      setPlagiarismLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const getPlagiarismVariant = (score) => {
    if (score === null || score === undefined) return { color: "text-muted-foreground", bg: "bg-muted border-border", banner: "bg-muted border-border text-muted-foreground" };
    if (score <= 15) return { color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800", banner: "bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900 text-green-700 dark:text-green-300" };
    if (score <= 25) return { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800", banner: "bg-yellow-50 dark:bg-yellow-950 border-yellow-100 dark:border-yellow-900 text-yellow-700 dark:text-yellow-300" };
    return { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800", banner: "bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300" };
  };

  const getPlagiarismStatus = (score) => {
    if (score === null || score === undefined) return "Not Available";
    if (score <= 15) return "Low";
    if (score <= 25) return "Moderate";
    return "High";
  };

  const validateForm = () => {
    if (!formData.overallRecommendation) {
      toast.error("Please select an overall recommendation.");
      return false;
    }
    if (!formData.commentsForAuthors.trim()) {
      toast.error("Comments for authors are required.");
      return false;
    }
    if (!formData.commentsForOrganizers.trim()) {
      toast.error("Comments for organizers are required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const response = await axios.post("/api/reviewer/submit-reviewform", {
        ...formData,
        paperId: paper,
        reviewerId: reviewer,
      });
      toast.success(response.data.message || "Review submitted successfully!");
      setFormData({
        originality: 1,
        technicalQuality: 1,
        significance: 1,
        clarity: 1,
        relevance: 1,
        overallRecommendation: "",
        commentsForAuthors: "",
        commentsForOrganizers: "",
      });
      navigate("/userdashboard/all-assigned-papers");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  const hasScore = plagiarismScore !== null && plagiarismScore !== undefined;
  const pVariant = getPlagiarismVariant(plagiarismScore);

  const renderRadioButtons = (name) => (
    <div className="flex justify-between gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
        <div key={score} className="flex flex-col items-center">
          <label className="text-xs text-muted-foreground">{score}</label>
          <input
            type="radio"
            name={name}
            value={score}
            checked={Number(formData[name]) === score}
            onChange={handleChange}
            className="w-4 h-4 accent-primary"
          />
        </div>
      ))}
    </div>
  );

  return (
    <Layout title="ConForum - Review Form">
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <form
            className="bg-card p-8 md:p-12 rounded-3xl shadow-2xl border border-border space-y-10"
            onSubmit={handleSubmit}
          >
            <div className="text-center border-b border-border pb-8">
              <h2 className="text-3xl font-extrabold tracking-tight">Manuscript Evaluation</h2>
              <p className="mt-2 text-muted-foreground font-medium italic">Title: {title}</p>
            </div>

            <div className={cn("rounded-2xl p-6 border", pVariant.bg)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                    Plagiarism Score from Organizer
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Entered by the conference organizer before reviewer assignment
                  </p>
                </div>
                <div className="text-right">
                  {plagiarismLoading ? (
                    <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
                  ) : (
                    <>
                      <div className={cn("text-3xl font-bold", pVariant.color)}>
                        {hasScore ? `${plagiarismScore}%` : "—"}
                      </div>
                      <div className={cn("text-xs font-semibold mt-1", pVariant.color)}>
                        {getPlagiarismStatus(plagiarismScore)}{hasScore ? " Similarity" : ""}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {!plagiarismLoading && hasScore && (
                <div className={cn("mt-3 p-3 rounded-xl border text-xs", pVariant.banner)}>
                  {plagiarismScore > 25
                    ? "⚠️ High similarity detected. Please consider this in your evaluation."
                    : plagiarismScore > 15
                    ? "⚠ Moderate similarity. Review the manuscript carefully for originality."
                    : "✓ Low similarity score. Originality appears satisfactory."}
                </div>
              )}
              {!plagiarismLoading && !hasScore && (
                <div className="mt-3 p-3 bg-muted rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">No plagiarism score has been recorded yet.</p>
                </div>
              )}
            </div>

            <div className="space-y-8">
              {[
                { name: "originality", label: "Originality", desc: "Is the work novel and unique?" },
                { name: "technicalQuality", label: "Technical Quality", desc: "Is the methodology sound and robust?" },
                { name: "significance", label: "Significance", desc: "Does this contribute to the field?" },
                { name: "clarity", label: "Clarity", desc: "Is the presentation clear and professional?" },
                { name: "relevance", label: "Relevance", desc: "Does it align with the conference scope?" },
              ].map(({ name, label, desc }) => (
                <div key={name} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-bold uppercase tracking-widest">{label}</label>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{desc}</span>
                  </div>
                  <div className="bg-muted/50 p-6 rounded-2xl border border-border">
                    {renderRadioButtons(name)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-widest">Overall Recommendation</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["Accept", "Accept with minor correction", "Reject"].map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "relative flex items-center justify-center p-4 cursor-pointer rounded-xl border-2 transition-all",
                      formData.overallRecommendation === option
                        ? "border-primary bg-primary/10 text-primary shadow-md"
                        : "border-border text-muted-foreground hover:border-primary/40 bg-card"
                    )}
                  >
                    <input
                      type="radio"
                      name="overallRecommendation"
                      value={option}
                      checked={formData.overallRecommendation === option}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest ml-1">
                  Comments for Authors
                </label>
                <Textarea
                  name="commentsForAuthors"
                  value={formData.commentsForAuthors}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Provide constructive feedback for the research team..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest ml-1">
                  Comments for Organizers
                </label>
                <Textarea
                  name="commentsForOrganizers"
                  value={formData.commentsForOrganizers}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Confidential notes for the conference committee..."
                />
              </div>
            </div>

            <div className="pt-8 border-t border-border">
              <Button
                type="submit"
                size="lg"
                className="w-full py-5 text-base font-extrabold rounded-2xl shadow-xl"
                disabled={loading}
              >
                {loading ? "SUBMITTING..." : "SUBMIT FINAL EVALUATION"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewForm;
