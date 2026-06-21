import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useAuth } from "../../context/Auth";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Loader2, Save, Lock } from "lucide-react";

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b">
    {children}
  </h3>
);

const EditConference = () => {
  const [auth] = useAuth();
  const navigate = useNavigate();
  const { selectedConference, loading: loadingConferences, refetchConferences } = useOrganizerConference();

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    conference_name: "",
    acronym: "",
    web_page: "",
    venue: "",
    city: "",
    country: "",
    start_date: "",
    end_date: "",
    abstract_deadline: "",
    submission_deadline: "",
    primary_area: "",
    secondary_area: "",
    topics: [],
    max_resubmissions: null,
  });
  const [limitResubmissions, setLimitResubmissions] = useState(false);
  const [maxResubmissionsInput, setMaxResubmissionsInput] = useState(1);
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries");
        const json = await res.json();
        if (!json.error && json.data) {
          const sorted = json.data.map(c => c.country).filter(Boolean).sort((a, b) => a.localeCompare(b));
          setCountries(sorted);
        }
      } catch {
        toast.error("Unable to load country list.");
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  const fetchCities = async (country) => {
    if (!country) { setCities([]); return; }
    setLoadingCities(true);
    setCities([]);
    try {
      const res = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      const json = await res.json();
      if (!json.error && json.data) setCities(json.data.sort((a, b) => a.localeCompare(b)));
    } catch {
      toast.error("Unable to load city list.");
    } finally {
      setLoadingCities(false);
    }
  };

  useEffect(() => {
    if (!selectedConference) {
      setFormData({
        conference_name: "", acronym: "", web_page: "", venue: "", city: "", country: "",
        start_date: "", end_date: "", abstract_deadline: "", submission_deadline: "",
        primary_area: "", secondary_area: "", topics: [], max_resubmissions: null,
      });
      setLimitResubmissions(false);
      setMaxResubmissionsInput(1);
      setCities([]);
      return;
    }

    const fetchConferenceDetails = async () => {
      setLoadingDetails(true);
      try {
        const { data } = await axios.get(`/api/conference/get-conference/${selectedConference.id}`);
        setFormData({
          conference_name: data.conference_name || "",
          acronym: data.acronym || "",
          web_page: data.web_page || "",
          venue: data.venue || "",
          city: data.city || "",
          country: data.country || "",
          start_date: data.start_date ? data.start_date.slice(0, 10) : "",
          end_date: data.end_date ? data.end_date.slice(0, 10) : "",
          abstract_deadline: data.abstract_deadline ? data.abstract_deadline.slice(0, 10) : "",
          submission_deadline: data.submission_deadline ? data.submission_deadline.slice(0, 10) : "",
          primary_area: data.primary_area || "",
          secondary_area: data.secondary_area || "",
          topics: data.topics || [],
          max_resubmissions: data.max_resubmissions,
        });
        const unlimited = data.max_resubmissions === null;
        setLimitResubmissions(!unlimited);
        if (!unlimited) setMaxResubmissionsInput(data.max_resubmissions);
        else setMaxResubmissionsInput(1);
        if (data.country) fetchCities(data.country);
      } catch (err) {
        toast.error("Could not load conference details.");
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchConferenceDetails();
  }, [selectedConference?.id]); // ← only re-run when the ID changes, not the whole object

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTopicsChange = (e) => {
    const topicsArray = e.target.value.split(",").map(t => t.trim());
    setFormData(prev => ({ ...prev, topics: topicsArray }));
  };

  const validateDates = () => {
    const { start_date, end_date, abstract_deadline, submission_deadline } = formData;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(start_date), end = new Date(end_date);
    const abstract = new Date(abstract_deadline), submission = new Date(submission_deadline);
    if (!start_date || !end_date || !abstract_deadline || !submission_deadline) {
      toast.error("All date fields are required."); return false;
    }
    if (start < today || end < today || abstract < today || submission < today) {
      toast.error("Dates must not be in the past."); return false;
    }
    if (end < start) { toast.error("End date must be after start date."); return false; }
    if (abstract > end) { toast.error("Abstract deadline must be before conference end."); return false; }
    if (submission < start || submission > end) {
      toast.error("Submission deadline must fall within conference dates."); return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConference) { toast.error("No conference selected."); return; }
    if (!formData.conference_name.trim() || !formData.acronym.trim() || !formData.start_date || !formData.end_date) {
      toast.error("Conference name, acronym, start and end dates are required.");
      return;
    }
    if (!validateDates()) return;
    if (limitResubmissions && (!maxResubmissionsInput || maxResubmissionsInput < 1)) {
      toast.error("Valid resubmission limit required (minimum 1).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        conferenceName: formData.conference_name,
        // acronym intentionally omitted — it is immutable once a conference is created,
        // since it is bound to existing manuscript IDs.
        webPage: formData.web_page,
        venue: formData.venue,
        city: formData.city,
        country: formData.country,
        startDate: formData.start_date,
        endDate: formData.end_date,
        abstractDeadline: formData.abstract_deadline,
        submissionDeadline: formData.submission_deadline,
        primaryArea: formData.primary_area,
        secondaryArea: formData.secondary_area,
        topics: formData.topics,
        max_resubmissions: limitResubmissions ? Number(maxResubmissionsInput) : null,
      };
      Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === "") && delete payload[key]);

      await axios.put(`/api/conference/update-conference/${selectedConference.id}`, payload);

      // Refresh context so sidebar and all other components get the updated name immediately
      await refetchConferences();

      toast.success("Conference updated successfully.");
      navigate("/userdashboard/organizer-dashboard");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update conference.");
    } finally {
      setSaving(false);
    }
  };

  if (!auth || !auth.user) {
    return (
      <Layout title="PaperDesk - Edit Conference">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="PaperDesk - Edit Conference">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight">Edit Conference</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Update the details of your conference. Changes take effect immediately.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Current Conference</CardTitle>
              <CardDescription>
                The conference you selected in the sidebar will be edited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingConferences ? (
                <Skeleton className="h-10 w-full" />
              ) : !selectedConference ? (
                <p className="text-sm text-muted-foreground">
                  No conference selected. Please select a conference from the sidebar first.
                </p>
              ) : (
                <div className="p-3 bg-muted/20 rounded-lg">
                  <p className="font-medium">{selectedConference.conference_name}</p>
                  <p className="text-xs text-muted-foreground">Acronym: {selectedConference.acronym}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedConference && (
            <Card className="shadow-sm mt-6">
              <CardContent className="p-8">
                {loadingDetails ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/3" />
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8">

                    <div>
                      <SectionTitle>Basic Information</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label>Conference Name *</Label>
                          <Input name="conference_name" value={formData.conference_name} onChange={handleChange} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1.5">
                            Acronym
                            <Lock className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
                          </Label>
                          <Input
                            name="acronym"
                            value={formData.acronym}
                            disabled
                            readOnly
                            className="bg-muted/40 cursor-not-allowed text-muted-foreground"
                          />
                          <p className="text-xs text-muted-foreground">
                            The acronym can't be changed after creation, since it's bound to existing manuscript IDs.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Website</Label>
                          <Input name="web_page" type="url" value={formData.web_page} onChange={handleChange} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <SectionTitle>Location</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                          <Label>Venue</Label>
                          <Input name="venue" value={formData.venue} onChange={handleChange} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Country</Label>
                          {loadingCountries ? (
                            <Skeleton className="h-10 w-full" />
                          ) : (
                            <Select
                              value={formData.country}
                              onValueChange={(val) => {
                                setFormData(prev => ({ ...prev, country: val, city: "" }));
                                fetchCities(val);
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                              <SelectContent className="max-h-64 overflow-y-auto">
                                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label>City</Label>
                          {loadingCities ? (
                            <Skeleton className="h-10 w-full" />
                          ) : cities.length > 0 ? (
                            <Select
                              value={formData.city}
                              onValueChange={(val) => setFormData(prev => ({ ...prev, city: val }))}
                              disabled={!formData.country}
                            >
                              <SelectTrigger><SelectValue placeholder={formData.country ? "Select city" : "Select country first"} /></SelectTrigger>
                              <SelectContent className="max-h-64 overflow-y-auto">
                                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              name="city"
                              value={formData.city}
                              onChange={handleChange}
                              placeholder={formData.country ? "Enter city" : "Select country first"}
                              disabled={!formData.country}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <SectionTitle>Dates</SectionTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {["start_date", "end_date", "abstract_deadline", "submission_deadline"].map(name => (
                          <div key={name} className="space-y-1.5">
                            <Label>
                              {name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} *
                            </Label>
                            <Input type="date" name={name} value={formData[name]} onChange={handleChange} required />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <SectionTitle>Research Areas</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label>Primary Area</Label>
                          <Input name="primary_area" value={formData.primary_area} onChange={handleChange} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Secondary Area</Label>
                          <Input name="secondary_area" value={formData.secondary_area} onChange={handleChange} />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <Label>Topics (comma‑separated)</Label>
                          <Input value={formData.topics.join(", ")} onChange={handleTopicsChange} placeholder="e.g. AI, Computer Vision, NLP" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <SectionTitle>Submission Settings</SectionTitle>
                      <div className="rounded-lg border bg-muted/30 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Limit resubmissions</p>
                            <p className="text-xs text-muted-foreground">Control how many times authors can resubmit a paper.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Unlimited</span>
                            <button
                              type="button"
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${limitResubmissions ? "bg-primary" : "bg-muted"}`}
                              onClick={() => setLimitResubmissions(!limitResubmissions)}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${limitResubmissions ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                            <span className="text-xs text-muted-foreground">Limited</span>
                          </div>
                        </div>
                        {limitResubmissions && (
                          <div className="space-y-2 pt-1 border-t border-border">
                            <Label htmlFor="maxResubmissions">Maximum resubmissions per paper *</Label>
                            <Input
                              id="maxResubmissions"
                              type="number"
                              min={1}
                              value={maxResubmissionsInput}
                              onChange={(e) => setMaxResubmissionsInput(Number(e.target.value))}
                              className="max-w-[140px]"
                            />
                            <p className="text-xs text-muted-foreground">Authors may resubmit their paper up to this many times.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => navigate("/userdashboard/organizer-dashboard")}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EditConference;