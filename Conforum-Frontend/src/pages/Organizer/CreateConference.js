import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useAuth } from "../../context/Auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Loader2 } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";

// ---------------------------------------------------------------------------
// ConferenceCreationForm
// Allows an organizer to submit a new conference for admin approval.
// On successful submission, dispatches a "conference-created" custom event so
// that the sidebar's OrganizerConferenceSelector can refresh its list without
// requiring a full logout/login cycle.
// ---------------------------------------------------------------------------

function ConferenceCreationForm() {
  const [auth] = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Country and city lists fetched from the countriesnow public API.
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  // Controls whether the resubmission limit toggle is on and what the cap is.
  const [limitResubmissions, setLimitResubmissions] = useState(false);
  const [maxResubmissions, setMaxResubmissions] = useState(1);

  // Default form state, kept as a constant so the form can be fully reset
  // after a successful submission without manually clearing each field.
  const initialFormData = {
    conferenceName: "",
    acronym: "",
    webPage: "",
    mode: "",
    venue: "",
    city: "",
    country: "",
    startDate: "",
    endDate: "",
    abstractDeadline: "",
    submissionDeadline: "",
    primaryArea: "",
    secondaryArea: "",
    topics: ["", "", "", ""],
    expertise: [],
  };

  const [formData, setFormData] = useState(initialFormData);

  // ---------------------------------------------------------------------------
  // Fetch country list once on mount.
  // Countries are sorted alphabetically for easier selection.
  // ---------------------------------------------------------------------------
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
      } catch {
        // Non-fatal: user can still type a country name manually if this fails.
        toast.error("Unable to load country list. You may type your country manually.");
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch city list whenever the selected country changes.
  // Resets the current city selection to avoid stale city/country combinations.
  // ---------------------------------------------------------------------------
  const fetchCities = async (country) => {
    if (!country) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    setCities([]);
    try {
      const res = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      const json = await res.json();
      if (!json.error && json.data) {
        setCities(json.data.sort((a, b) => a.localeCompare(b)));
      }
    } catch {
      // Non-fatal: falls back to a free-text city input.
      toast.error("Unable to load city list. You may type your city manually.");
    } finally {
      setLoadingCities(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Generic change handler for standard text inputs.
  // The "expertise" field is stored as an array internally but displayed as a
  // comma-separated string, so it is split back into an array on each change.
  // ---------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "expertise"
          ? value.split(",").map((item) => item.trim())
          : value,
    }));
  };

  // Updates a single topic by index without mutating the rest of the array.
  const handleTopicChange = (index, value) => {
    const updatedTopics = [...formData.topics];
    updatedTopics[index] = value;
    setFormData({ ...formData, topics: updatedTopics });
  };

  // ---------------------------------------------------------------------------
  // Validates that all required text fields are filled in before submission.
  // Returns false and shows a toast for the first missing field found.
  // ---------------------------------------------------------------------------
  const validateRequiredFields = () => {
    const { conferenceName, acronym, startDate, endDate, mode, expertise } = formData;

    if (!conferenceName.trim()) {
      toast.error("Conference name is required.");
      return false;
    }
    if (!acronym.trim()) {
      toast.error("Acronym is required.");
      return false;
    }
    if (!startDate || !endDate) {
      toast.error("Start and end dates are required.");
      return false;
    }
    if (!mode) {
      toast.error("Please select a review mode.");
      return false;
    }
    if (!expertise || expertise.length === 0 || expertise.every((e) => e.trim() === "")) {
      toast.error("At least one area of expertise is required.");
      return false;
    }
    if (limitResubmissions && (!maxResubmissions || maxResubmissions < 1)) {
      toast.error("Please enter a valid resubmission limit (minimum 1).");
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Validates all four date fields for logical consistency:
  //   - No date may be in the past.
  //   - End date must be after start date.
  //   - Abstract deadline must be before the conference ends.
  //   - Submission deadline must fall within the conference window.
  // Returns false and shows a toast for the first violation found.
  // ---------------------------------------------------------------------------
  const validateDates = () => {
    const { startDate, endDate, abstractDeadline, submissionDeadline } = formData;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const abstract = new Date(abstractDeadline);
    const submission = new Date(submissionDeadline);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!startDate || !endDate || !abstractDeadline || !submissionDeadline) {
      toast.error("All date fields are required.");
      return false;
    }
    if (start < today || end < today || abstract < today || submission < today) {
      toast.error("Dates must not be in the past.");
      return false;
    }
    if (end < start) {
      toast.error("End date must be after the start date.");
      return false;
    }
    if (abstract > end) {
      toast.error("Abstract deadline must fall before the conference end date.");
      return false;
    }
    if (submission < start || submission > end) {
      toast.error("Submission deadline must fall within the conference dates.");
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Submits the form to the backend.
  //
  // On success:
  //   1. Shows a success toast.
  //   2. Resets the form to its initial state.
  //   3. Dispatches the "conference-created" custom event on window so that
  //      OrganizerConferenceSelector (inside the sidebar) can react and
  //      re-fetch the conference list immediately without needing a page
  //      reload or logout.
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateRequiredFields() || !validateDates()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        userId: auth?.user?._id,
        // Only include max_resubmissions when the toggle is on; otherwise null
        // signals to the backend that resubmissions are unlimited.
        max_resubmissions: limitResubmissions ? Number(maxResubmissions) : null,
      };

      await axios.post("/api/conference/create-conference", payload);

      toast.success("Conference submitted for admin approval.");

      // Reset all controlled form state back to defaults.
      setFormData(initialFormData);
      setCities([]);
      setLimitResubmissions(false);
      setMaxResubmissions(1);

      // Notify other components (e.g. sidebar conference selector) that a new
      // conference has been created so they can refresh without a full reload.
      window.dispatchEvent(new Event("conference-created"));
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "An unexpected error occurred. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Small presentational component for consistent section headings inside the form.
  const SectionTitle = ({ children }) => (
    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b">
      {children}
    </h3>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout title="ConForum - Create Conference">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto">

          {/* Page heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight">Create Conference</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Submit a new conference for admin approval
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* ----------------------------------------------------------------
                    Section: Basic Information
                    Core identity fields: name, acronym, website, and review mode.
                ---------------------------------------------------------------- */}
                <div>
                  <SectionTitle>Basic Information</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <div className="space-y-1.5">
                      <Label>
                        Conference Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        name="conferenceName"
                        value={formData.conferenceName}
                        onChange={handleChange}
                        placeholder="Full conference name"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        Acronym <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        name="acronym"
                        value={formData.acronym}
                        onChange={handleChange}
                        placeholder="e.g. ICML 2025"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Website</Label>
                      <Input
                        name="webPage"
                        type="url"
                        value={formData.webPage}
                        onChange={handleChange}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        Review Mode <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        onValueChange={(val) =>
                          setFormData({ ...formData, mode: val })
                        }
                        value={formData.mode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="double-blind">Double Blind</SelectItem>
                          <SelectItem value="single-blind">Single Blind</SelectItem>
                          <SelectItem value="open">Open Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                  </div>
                </div>

                {/* ----------------------------------------------------------------
                    Section: Location
                    Venue, country, and city. Country selection triggers a city
                    fetch. If the API returns no cities, falls back to a text input.
                ---------------------------------------------------------------- */}
                <div>
                  <SectionTitle>Location</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                    <div className="space-y-1.5">
                      <Label>Venue</Label>
                      <Input
                        name="venue"
                        value={formData.venue}
                        onChange={handleChange}
                        placeholder="Venue or hotel name"
                      />
                    </div>

                    {/* Country selector - shows skeleton while loading */}
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      {loadingCountries ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : (
                        <Select
                          value={formData.country}
                          onValueChange={(val) => {
                            // Reset city whenever country changes to prevent
                            // a stale city from a previous selection persisting.
                            setFormData((prev) => ({ ...prev, country: val, city: "" }));
                            fetchCities(val);
                          }}
                        >
                          <SelectTrigger>
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

                    {/* City selector - shows skeleton while loading, falls back
                        to a text input when no cities are returned by the API */}
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      {loadingCities ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : cities.length > 0 ? (
                        <Select
                          value={formData.city}
                          onValueChange={(val) =>
                            setFormData((prev) => ({ ...prev, city: val }))
                          }
                          disabled={!formData.country}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                formData.country
                                  ? "Select city"
                                  : "Select a country first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 overflow-y-auto">
                            {cities.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder={
                            formData.country
                              ? "Enter city"
                              : "Select a country first"
                          }
                          disabled={!formData.country}
                        />
                      )}
                    </div>

                  </div>
                </div>

                {/* ----------------------------------------------------------------
                    Section: Dates
                    All four date fields are required. Validation logic lives in
                    validateDates() which is called before submission.
                ---------------------------------------------------------------- */}
                <div>
                  <SectionTitle>Dates</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                      { label: "Start Date",           name: "startDate"          },
                      { label: "End Date",             name: "endDate"            },
                      { label: "Abstract Deadline",    name: "abstractDeadline"   },
                      { label: "Submission Deadline",  name: "submissionDeadline" },
                    ].map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <Label>
                          {field.label} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="date"
                          name={field.name}
                          value={formData[field.name]}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ----------------------------------------------------------------
                    Section: Research Areas
                    Primary/secondary areas, expertise tags, and up to four topic
                    keywords that help match reviewers to submissions.
                ---------------------------------------------------------------- */}
                <div>
                  <SectionTitle>Research Areas</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <div className="space-y-1.5">
                      <Label>Primary Area</Label>
                      <Input
                        name="primaryArea"
                        value={formData.primaryArea}
                        onChange={handleChange}
                        placeholder="e.g. Machine Learning"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Secondary Area</Label>
                      <Input
                        name="secondaryArea"
                        value={formData.secondaryArea}
                        onChange={handleChange}
                        placeholder="e.g. Computer Vision"
                      />
                    </div>

                    {/* Expertise is stored as an array but edited as a comma-
                        separated string. handleChange splits it back on input. */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>
                        Required Expertise (comma-separated){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        name="expertise"
                        value={formData.expertise.join(", ")}
                        onChange={handleChange}
                        placeholder="e.g. AI, Machine Learning, NLP"
                        required
                      />
                    </div>

                  </div>

                  {/* Up to four optional topic keywords */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                    {formData.topics.map((topic, index) => (
                      <div key={index} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Topic {index + 1}
                        </Label>
                        <Input
                          value={topic}
                          onChange={(e) => handleTopicChange(index, e.target.value)}
                          placeholder={`Topic ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ----------------------------------------------------------------
                    Section: Submission Settings
                    Optional toggle to cap how many times authors can resubmit.
                    When the toggle is off, max_resubmissions is sent as null
                    (unlimited) to the backend.
                ---------------------------------------------------------------- */}
                <div>
                  <SectionTitle>Submission Settings</SectionTitle>
                  <div className="rounded-lg border bg-muted/30 p-5 space-y-4">

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Limit resubmissions
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Control how many times authors can resubmit a paper
                          after receiving feedback.
                        </p>
                      </div>
                      <Switch
                        checked={limitResubmissions}
                        onCheckedChange={setLimitResubmissions}
                      />
                    </div>

                    {/* Revealed only when the toggle is on */}
                    {limitResubmissions && (
                      <div className="space-y-2 pt-1 border-t border-border">
                        <Label htmlFor="maxResubmissions">
                          Maximum resubmissions per paper{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="maxResubmissions"
                          type="number"
                          min={1}
                          value={maxResubmissions}
                          onChange={(e) => setMaxResubmissions(e.target.value)}
                          className="max-w-[140px]"
                          placeholder="e.g. 3"
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Authors may resubmit their paper up to this many times
                          after receiving reviewer feedback. Leave unlimited to
                          allow any number of resubmissions.
                        </p>
                      </div>
                    )}

                  </div>
                </div>

                {/* Submit button - disabled while the request is in flight */}
                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={submitting} size="lg">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      "Submit for Approval"
                    )}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}

export default ConferenceCreationForm;