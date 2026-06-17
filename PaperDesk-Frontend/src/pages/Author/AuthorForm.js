import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import axios from "axios";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Loader2,
  X,
  Upload,
  CheckCircle,
  FileText,
  Users,
  BookOpen,
  Shield,
} from "lucide-react";

function AuthorForm({ conferenceName }) {
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [paper, setPaper] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmittingMessage, setShowSubmittingMessage] = useState(false);
  const { acronym, id } = useParams();
  const navigate = useNavigate();
  const [fetchedConferenceName, setFetchedConferenceName] = useState("");
  const [conferenceMode, setConferenceMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [auth, , , fetchRoles] = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [abstractWordCount, setAbstractWordCount] = useState(0);
  const [validationResult, setValidationResult] = useState(null);

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  const [authors, setAuthors] = useState([
    {
      firstName: "",
      lastName: "",
      email: "",
      country: "",
      affiliation: "",
      webPage: "",
      corresponding: false,
    },
  ]);

  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries");
        const json = await res.json();
        if (!json.error && json.data) {
          const sorted = json.data
            .map((c) => c.country)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
          setCountries(sorted);
        }
      } catch (error) {
        toast.error("Unable to load country list.");
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    const fetchConference = async () => {
      try {
        const response = await axios.get(`/api/conference/get-conference/${id}`);
        setFetchedConferenceName(response.data.conference_name);
        if (response.data.mode) {
          setConferenceMode(response.data.mode);
        }
      } catch (error) {
        console.error("Error fetching conference:", error);
      }
    };
    fetchConference();
  }, [id]);

  useEffect(() => {
    if (auth?.user) {
      setAuthors([
        {
          firstName: "",
          lastName: "",
          email: auth?.user?.email || "",
          country: "",
          affiliation: "",
          webPage: "",
          corresponding: false,
        },
      ]);
      setLoading(false);
    }
  }, [auth]);

  const removeFile = () => {
    setSelectedFile(null);
    setPaper(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addAuthor = () => {
    if (authors.length >= 15) {
      toast.error("You can add up to 15 authors only.");
      return;
    }
    setAuthors([
      ...authors,
      {
        firstName: "",
        lastName: "",
        email: "",
        country: "",
        affiliation: "",
        webPage: "",
        corresponding: false,
      },
    ]);
  };

  const removeAuthor = (index) => {
    if (index === 0) return;
    setAuthors(authors.filter((_, i) => i !== index));
  };

  const handleInputChange = (index, event) => {
    const { name, value } = event.target;
    const newAuthors = [...authors];
    newAuthors[index][name] = value;
    setAuthors(newAuthors);
  };

  const handleCountryChange = (index, value) => {
    const newAuthors = [...authors];
    newAuthors[index].country = value;
    setAuthors(newAuthors);
  };

  // Ensures only one author can be marked as corresponding at a time.
  const handleCorrespondingChange = (index) => {
    setAuthors(authors.map((author, i) => ({
      ...author,
      corresponding: i === index ? !author.corresponding : false,
    })));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      removeFile();
      toast.error("Please upload a PDF file only.");
      return;
    }

    setSelectedFile(file);
    setPaper(file);
    setValidationResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!paper) {
      toast.error("Please upload a PDF manuscript before submitting.");
      return;
    }

    const currentWordCount = abstract.trim().split(/\s+/).filter(Boolean).length;
    if (currentWordCount < 100 || currentWordCount > 300) {
      toast.error(`Abstract must be between 100 and 300 words. You currently have ${currentWordCount}.`);
      return;
    }

    const titleWordCount = title.trim().split(/\s+/).filter(Boolean).length;
    if (titleWordCount < 3) {
      toast.error("Title must be at least 3 words.");
      return;
    }

    const keywordsArray = keywords.split(",").map((kw) => kw.trim()).filter(Boolean);
    if (keywordsArray.length > 8) {
      toast.error("Keywords should not be more than 8.");
      return;
    }

    const validAuthor = authors.find(
      (author) => author.firstName && author.email && author.country
    );
    if (!validAuthor) {
      toast.error("At least one author must have mandatory details and country filled.");
      return;
    }

    const hasCorresponding = authors.some((a) => a.corresponding);
    if (!hasCorresponding) {
      toast.error("Please select one corresponding author.");
      return;
    }

    // Block organizers (Editors) from submitting papers across any conference
    const isOrganizer = auth?.roles?.some((role) => role.role === "organizer");
    if (isOrganizer) {
      toast.error("Editors are not allowed to submit papers.");
      return;
    }

    await submitForm();
  };

  const submitForm = async () => {
    setIsSubmitting(true);
    setShowSubmittingMessage(true);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("abstract", abstract);
      formData.append("keywords", keywords);
      formData.append("paper", paper);
      formData.append("authors", JSON.stringify(authors));
      formData.append("conferenceId", id);
      formData.append("conferenceAcronym", acronym);
      formData.append("conferenceName", fetchedConferenceName);
      formData.append("userId", auth?.user?._id);

      const response = await axios.post("/api/author/submit-paper", formData);

      const validation = response.data?.data?.validation ?? response.data?.data?.paper?.validation_info ?? null;
      setValidationResult(validation);

      if (validation && validation.validated === false) {
        toast.error(validation.message || "PDF validation failed. Please check your file.");
        setValidationResult(null);
        return;
      }

      toast.success(response.data.message);
      await fetchRoles(auth?.user?._id);
      navigate("/userdashboard/papers");
    } catch (error) {
      console.error("Submission error:", error.response?.data);
      toast.error(
        error.response?.data?.message || "Error while submitting your paper"
      );
    } finally {
      setIsSubmitting(false);
      setShowSubmittingMessage(false);
    }
  };

  if (loading) {
    return (
      <Layout title="PaperDesk - Submit paper">
        <div className="flex justify-center items-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="PaperDesk - Submit paper">
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">

          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
              Submit Your Research
            </h1>
            <p className="mt-4 text-lg text-muted-foreground font-medium">
              to{" "}
              <span className="text-primary font-bold">
                {conferenceName || fetchedConferenceName}
              </span>
            </p>
            <div className="mt-4 flex justify-center">
              <div className="w-16 h-1 bg-primary rounded-full"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Authors Section */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Author Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {authors.map((author, index) => (
                  <div
                    key={index}
                    className="relative p-6 bg-muted/20 rounded-2xl border border-border group"
                  >
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => removeAuthor(index)}
                        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-destructive rounded-full transition-all"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}

                    <div className="flex items-center space-x-3 mb-6">
                      <div className="h-8 w-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-foreground uppercase tracking-wider text-sm">
                        Author Details
                      </h3>
                      {author.corresponding && (
                        <Badge variant="default" className="text-xs ml-auto mr-8">
                          Corresponding Author
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                          First Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="text"
                          name="firstName"
                          value={author.firstName}
                          onChange={(e) => handleInputChange(index, e)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                          Last Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="text"
                          name="lastName"
                          value={author.lastName}
                          onChange={(e) => handleInputChange(index, e)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                          Email <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="email"
                          name="email"
                          value={author.email}
                          onChange={(e) => handleInputChange(index, e)}
                          disabled={index === 0}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                          Country <span className="text-destructive">*</span>
                        </label>
                        {loadingCountries ? (
                          <Skeleton className="h-10 w-full rounded-md" />
                        ) : (
                          <Select
                            value={author.country}
                            onValueChange={(val) => handleCountryChange(index, val)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-64 overflow-y-auto">
                              {countries.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                          Affiliation <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="text"
                          name="affiliation"
                          value={author.affiliation}
                          onChange={(e) => handleInputChange(index, e)}
                          placeholder="University or Institution Name"
                          required
                        />
                      </div>
                    </div>

                    {/* Corresponding author checkbox — only one can be selected */}
                    <div className="mt-5 flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        id={`corresponding-${index}`}
                        checked={author.corresponding}
                        onChange={() => handleCorrespondingChange(index)}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                      <label
                        htmlFor={`corresponding-${index}`}
                        className="text-xs font-bold text-muted-foreground uppercase tracking-widest cursor-pointer select-none"
                      >
                        Mark as Corresponding Author
                      </label>
                    </div>
                  </div>
                ))}

                {authors.length < 15 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAuthor}
                    className="w-full py-6 border-dashed"
                  >
                    + Add Co-Author
                  </Button>
                )}

                {authors.length === 14 && (
                  <p className="text-center text-xs text-muted-foreground">
                    You can add one more author (maximum 15)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Paper Details Section */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Paper Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground ml-1">
                    Paper Title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter the full title of your research paper"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end ml-1">
                    <label className="text-sm font-bold text-foreground">
                      Abstract <span className="text-destructive">*</span>
                    </label>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        abstractWordCount < 100 || abstractWordCount > 300
                          ? "text-destructive"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {abstractWordCount} / 300 Words
                    </span>
                  </div>
                  <Textarea
                    rows="8"
                    value={abstract}
                    onChange={(e) => {
                      setAbstract(e.target.value);
                      const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                      setAbstractWordCount(words.length);
                    }}
                    placeholder="Provide a concise summary of your research (100-300 words)"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground ml-1">
                    Keywords <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="Comma separated (e.g. AI, Deep Learning, Cloud Computing)"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Manuscript Upload Section */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Manuscript Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {conferenceMode && (
                  <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <div className="flex">
                      <div className="flex-shrink-0 mt-0.5">
                        <Shield className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wider">
                          {conferenceMode.replace("-", " ")} Review Process
                        </h3>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                          This conference is <strong>{conferenceMode}</strong>.
                          {conferenceMode === "double-blind" &&
                            " Please ensure you hide your identity and remove all author names, affiliations, and identifying information from the PDF manuscript before uploading."}
                          {conferenceMode === "single-blind" &&
                            " Reviewers will know your identity, but the reviewers remain anonymous. You may include your details in the manuscript."}
                          {conferenceMode === "no-blind" &&
                            " Both parties will know each other's identities. You may include your author details in the manuscript."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={`relative group border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
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
                  <div className="space-y-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors ${
                        selectedFile
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                      }`}
                    >
                      {selectedFile ? (
                        <CheckCircle className="w-8 h-8" />
                      ) : (
                        <Upload className="w-8 h-8" />
                      )}
                    </div>

                    {selectedFile ? (
                      <div>
                        <p className="text-lg font-bold truncate max-w-xs mx-auto text-green-600 dark:text-green-400">
                          {selectedFile.name}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Remove and Replace
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-bold text-foreground">
                          Click to upload PDF
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">
                          IEEE Format Preferred
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="pt-8">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg font-extrabold"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>SUBMITTING MANUSCRIPT...</span>
                  </div>
                ) : (
                  "SUBMIT RESEARCH PAPER"
                )}
              </Button>

              {showSubmittingMessage && (
                <p className="text-center text-xs font-bold text-primary mt-4 uppercase tracking-widest animate-pulse">
                  Your submission is being processed. Please do not refresh.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default AuthorForm;