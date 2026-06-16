import React, { useEffect, useState, useCallback, useRef } from "react";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Loader2, ChevronDown, Search, CheckCircle2, X } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** ISO2 code → emoji flag (pure JS, zero network) */
function isoToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function digitsOnly(v) {
  return (v || "").replace(/\D/g, "");
}

// Per-country national number length hints
const PHONE_HINTS = {
  PK:{min:10,max:10},US:{min:10,max:10},CA:{min:10,max:10},
  GB:{min:10,max:10},IN:{min:10,max:10},AE:{min:9,max:9},
  SA:{min:9,max:9},  DE:{min:10,max:12},FR:{min:9,max:9},
  CN:{min:11,max:11},AU:{min:9,max:9}, BD:{min:10,max:10},
  NG:{min:10,max:10},EG:{min:10,max:10},PH:{min:10,max:10},
  TR:{min:10,max:10},ID:{min:9,max:12}, BR:{min:10,max:11},
  MX:{min:10,max:10},ZA:{min:9,max:9}, MY:{min:9,max:10},
  KE:{min:9,max:9},  JP:{min:10,max:11},QA:{min:8,max:8},
  KW:{min:8,max:8},  OM:{min:8,max:8},  JO:{min:9,max:9},
  IR:{min:10,max:10},IQ:{min:10,max:10},LB:{min:7,max:8},
  SG:{min:8,max:8},  NZ:{min:8,max:9}, TH:{min:9,max:9},
};

// ─── PhoneField ────────────────────────────────────────────────────────────────
const PhoneField = ({ countries, loading, selectedCountry, onCountryChange, register, errors }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const searchRef   = useRef(null);

  const filtered = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search.replace(/\D/g, ""))
  );

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const phoneRules = {
    required: "Phone number is required.",
    validate: (v) => {
      const digits = digitsOnly(v);
      if (digits.length < 4) return "Enter a valid phone number.";
      const hint = PHONE_HINTS[selectedCountry?.code];
      if (hint) {
        if (digits.length < hint.min)
          return `Must be ${hint.min} digits for ${selectedCountry.name}.`;
        if (digits.length > hint.max)
          return `Max ${hint.max} digits for ${selectedCountry.name}.`;
      } else if (digits.length > 15) {
        return "Too long — max 15 digits.";
      }
      return true;
    },
  };

  const hasError = !!errors.phone;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="phone">Phone number</Label>

      <div className="flex" ref={dropdownRef}>
        {/* ── Dial-code trigger button ── */}
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen((o) => !o)}
          className={`
            relative flex items-center gap-2 h-10 pl-3 pr-2.5
            border rounded-l-md border-r-0
            bg-muted/30 hover:bg-muted/60 active:bg-muted
            transition-colors text-sm font-medium
            min-w-[108px] shrink-0
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError ? "border-destructive" : "border-input"}
          `}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select country"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedCountry ? (
            <>
              <span className="text-xl leading-none select-none" aria-hidden>
                {selectedCountry.flag}
              </span>
              <span className="text-muted-foreground font-mono text-xs tracking-tight">
                {selectedCountry.dial}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">+--</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* ── Number input ── */}
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          placeholder={
            selectedCountry?.code === "PK" ? "3001234567" :
            selectedCountry?.code === "US" || selectedCountry?.code === "CA" ? "2015550123" :
            selectedCountry?.code === "GB" ? "7911123456" :
            selectedCountry?.code === "IN" ? "9876543210" :
            selectedCountry?.code === "AE" ? "501234567" :
            "Enter number"
          }
          {...register("phone", phoneRules)}
          className={`rounded-l-none border-l-0 flex-1 font-mono ${hasError ? "border-destructive" : ""}`}
        />

        {/* ── Dropdown panel ── */}
        {open && (
          <div
            className="absolute z-50 mt-11 w-72 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            role="listbox"
            aria-label="Country list"
          >
            {/* Search bar */}
            <div className="p-2.5 border-b border-border bg-muted/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by country or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="
                    w-full pl-8 pr-8 py-2 text-sm
                    bg-background border border-input rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-ring
                    placeholder:text-muted-foreground
                  "
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Country list */}
            <ul className="max-h-56 overflow-y-auto overscroll-contain py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No countries match "{search}"
                </li>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedCountry?.code === c.code;
                  return (
                    <li key={c.code} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => {
                          onCountryChange(c);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left
                          transition-colors hover:bg-accent
                          ${isSelected ? "bg-accent/60 font-medium" : ""}
                        `}
                      >
                        <span className="text-xl w-8 text-center shrink-0 select-none" aria-hidden>
                          {c.flag}
                        </span>
                        <span className="flex-1 truncate text-foreground">{c.name}</span>
                        <span className="text-muted-foreground font-mono text-xs shrink-0">{c.dial}</span>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-3 py-2 border-t border-border bg-muted/10">
                <p className="text-[11px] text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "country" : "countries"}
                  {search ? ` matching "${search}"` : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation message or hint */}
      {errors.phone ? (
        <p className="text-destructive text-xs font-medium flex items-center gap-1">
          <X className="h-3 w-3 shrink-0" /> {errors.phone.message}
        </p>
      ) : selectedCountry ? (
        <p className="text-xs text-muted-foreground">
          Digits only — saved as{" "}
          <span className="font-mono font-medium text-foreground">{selectedCountry.dial} ···</span>
          {PHONE_HINTS[selectedCountry.code] &&
            ` · ${PHONE_HINTS[selectedCountry.code].min} digits`}
        </p>
      ) : null}
    </div>
  );
};

// ─── LocationFields ────────────────────────────────────────────────────────────
const LocationFields = ({ countries, countriesLoading, selectedCountry, onCountryChange,
  setValue, register, errors, watch }) => {
  const [citiesData, setCitiesData]       = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const watchCountry = watch("country");

  const fetchCities = useCallback(async (countryName) => {
    if (!countryName) return;
    setCitiesLoading(true);
    setCitiesData([]);
    setValue("city", "");
    try {
      const res = await fetch(
        "https://raw.githubusercontent.com/russ666/all-countries-and-cities-json/master/countries.min.json"
      );
      const data = await res.json();
      const cities = data[countryName];
      setCitiesData(Array.isArray(cities) ? cities.sort() : []);
    } catch {
      setCitiesData([]);
    } finally {
      setCitiesLoading(false);
    }
  }, [setValue]);

  useEffect(() => {
    if (!watchCountry) return;
    const match = countries.find((c) => c.name === watchCountry);
    if (match && match.code !== selectedCountry?.code) {
      onCountryChange(match);
    }
    fetchCities(watchCountry);
  }, [watchCountry]); // eslint-disable-line

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Country */}
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <div className="relative">
          <select
            id="country"
            {...register("country", { required: "Select your country." })}
            disabled={countriesLoading}
            className={`
              w-full h-10 pl-3 pr-8 text-sm border rounded-md
              bg-background appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-ring
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${errors.country ? "border-destructive" : "border-input"}
            `}
          >
            <option value="">
              {countriesLoading ? "Loading…" : "Select country"}
            </option>
            {countries.map((c) => (
              <option key={c.code} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          {countriesLoading ? (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
          ) : (
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
        {errors.country && (
          <p className="text-destructive text-xs font-medium flex items-center gap-1">
            <X className="h-3 w-3" />{errors.country.message}
          </p>
        )}
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label htmlFor="city">
          City
          {citiesLoading && (
            <Loader2 className="inline ml-1.5 h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </Label>

        {citiesData.length > 0 ? (
          <div className="relative">
            <select
              id="city"
              {...register("city", { required: "Select your city." })}
              className={`
                w-full h-10 pl-3 pr-8 text-sm border rounded-md
                bg-background appearance-none cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-ring
                ${errors.city ? "border-destructive" : "border-input"}
              `}
            >
              <option value="">Select city</option>
              {citiesData.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        ) : (
          <Input
            id="city"
            placeholder={
              !watchCountry ? "Country first" :
              citiesLoading ? "Loading…" : "Your city"
            }
            disabled={!watchCountry || citiesLoading}
            {...register("city", { required: "City is required." })}
            className={errors.city ? "border-destructive" : ""}
          />
        )}

        {errors.city && (
          <p className="text-destructive text-xs font-medium flex items-center gap-1">
            <X className="h-3 w-3" />{errors.city.message}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Register page ──────────────────────────────────────────────────────────────
const Register = () => {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get("token");

  // Invite state
  const [inviteEmail, setInviteEmail]                   = useState("");
  const [inviteRole, setInviteRole]                     = useState("");
  const [inviteConferenceId, setInviteConferenceId]     = useState("");
  const [inviteConferenceName, setInviteConferenceName] = useState("");
  const [tokenLoading, setTokenLoading]                 = useState(!!token);
  const [tokenValid, setTokenValid]                     = useState(!token);
  const [expertiseOptions, setExpertiseOptions]         = useState([]);

  // UI state
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [emailExistsError, setEmailExistsError] = useState(false);

  // Countries from API
  const [countries, setCountries]               = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [selectedCountry, setSelectedCountry]   = useState(null);

  const isReviewer = inviteRole === "reviewer";

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm({ defaultValues: { expertise: [], phone: "", country: "", city: "" } });

  const navigate = useNavigate();

  // ── Fetch countries ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res  = await fetch(
          "https://raw.githubusercontent.com/annexare/Countries/master/dist/countries.min.json"
        );
        const data = await res.json();

        const parsed = Object.entries(data)
          .filter(([code]) => code.length === 2)
          .map(([code, info]) => {
            const phones = info.phone || [];
            if (!phones.length) return null;
            return {
              code,
              name: info.name,
              flag: isoToFlag(code),
              dial: "+" + phones[0],
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));

        setCountries(parsed);

        // Default → Pakistan
        const pk = parsed.find((c) => c.code === "PK") || parsed[0];
        setSelectedCountry(pk);
        if (pk) setValue("country", pk.name);
      } catch {
        toast.error("Could not load country list. Check your connection.");
      } finally {
        setCountriesLoading(false);
      }
    };
    fetchCountries();
  }, [setValue]);

  // ── Fetch invite token ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const fetchInvite = async () => {
      try {
        const res = await axios.get(`/api/auth/invitation/${token}`);
        if (res.data.success) {
          const d = res.data.data;
          setInviteEmail(d.email);
          setInviteRole(d.role);
          setInviteConferenceId(d.conferenceId || "");
          setInviteConferenceName(d.conferenceName || "");
          setExpertiseOptions(d.expertise || []);
          setValue("email", d.email);
          setTokenValid(true);
        } else setTokenValid(false);
      } catch { setTokenValid(false); }
      finally  { setTokenLoading(false); }
    };
    fetchInvite();
  }, [token, setValue]);

  // ── Handle country change (syncs phone picker ↔ country select) ───────────
  const handleCountryChange = useCallback((country) => {
    setSelectedCountry(country);
    setValue("country", country.name, { shouldValidate: true });
    setValue("city", "");
  }, [setValue]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setEmailExistsError(false);
    try {
      const fullPhone = `${selectedCountry?.dial || ""}${digitsOnly(data.phone)}`;
      const payload = {
        name:            data.name,
        email:           data.email,
        phone:           fullPhone,
        address:         `${data.city}, ${data.country}`,
        expertise:       data.expertise,
        role:            inviteRole || undefined,
        conferenceId:    inviteConferenceId || undefined,
        conferenceName:  inviteConferenceName || undefined,
        invitationToken: token || undefined,
      };

      const res = await axios.post("/api/auth/register", payload);
      if (res.data.success) {
        toast.success("Account created! Please sign in.");
        navigate("/login");
      } else {
        toast.error(res.data.message || "Registration failed.");
      }
    } catch (error) {
      const msg  = error?.response?.data?.message || "";
      const code = error?.response?.status;
      if (code === 409 || /already|exist|registered/i.test(msg)) {
        setEmailExistsError(true);
        toast.error("Email already registered. Redirecting to sign in…");
        setTimeout(() => navigate("/login"), 2000);
      } else if (msg && !/server|internal/i.test(msg)) {
        toast.error(msg);
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (name) => errors[name]?.message;

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (tokenLoading) {
    return (
      <Layout title="PaperDesk - Register">
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
          <div className="w-full max-w-md">
            <div className="text-center mb-8 space-y-2">
              <Skeleton className="h-9 w-52 mx-auto" />
              <Skeleton className="h-4 w-44 mx-auto" />
            </div>
            <Card className="shadow-lg">
              <CardContent className="p-8 space-y-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
                <Skeleton className="h-11 w-full rounded-md" />
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Invalid token ─────────────────────────────────────────────────────────
  if (token && !tokenValid) {
    return (
      <Layout title="PaperDesk - Invalid Link">
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-7 h-7 text-destructive" />
              </div>
              <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
              <p className="text-muted-foreground text-sm">
                This invitation link is no longer valid. Request a new one from the conference Editor.
              </p>
              <Button className="mt-6" onClick={() => navigate("/login")}>
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ─── Main form ─────────────────────────────────────────────────────────────
  return (
    <Layout title="PaperDesk - Register">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
        <div className="w-full max-w-md animate-fade-in">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {inviteRole
                ? `Register as ${inviteRole === "organizer" ? "Editor" : inviteRole}`
                : "Create an account"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {inviteConferenceName
                ? `Joining: ${inviteConferenceName}`
                : "Start managing your research journey"}
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Invited-as banner */}
                {inviteEmail && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-medium text-primary">
                    Invited as: <span className="font-bold">{inviteEmail}</span>
                  </div>
                )}

                {/* Full name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    {...register("name", {
                      required: "Full name is required.",
                      minLength: { value: 2, message: "At least 2 characters." },
                    })}
                    className={fieldError("name") ? "border-destructive" : ""}
                  />
                  {fieldError("name") && (
                    <p className="text-destructive text-xs font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />{fieldError("name")}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    disabled={!!inviteEmail}
                    {...register("email", {
                      required: "Email is required.",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email address.",
                      },
                    })}
                    className={fieldError("email") || emailExistsError ? "border-destructive" : ""}
                  />
                  {fieldError("email") && (
                    <p className="text-destructive text-xs font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />{fieldError("email")}
                    </p>
                  )}
                  {emailExistsError && (
                    <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                      <X className="h-3 w-3 shrink-0" />
                      This email is already registered.{" "}
                      <button type="button" onClick={() => navigate("/login")}
                        className="underline hover:no-underline font-semibold">
                        Sign in here
                      </button>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="relative">
                  <PhoneField
                    countries={countries}
                    loading={countriesLoading}
                    selectedCountry={selectedCountry}
                    onCountryChange={handleCountryChange}
                    register={register}
                    errors={errors}
                  />
                </div>

                {/* Country + City */}
                <LocationFields
                  countries={countries}
                  countriesLoading={countriesLoading}
                  selectedCountry={selectedCountry}
                  onCountryChange={handleCountryChange}
                  setValue={setValue}
                  register={register}
                  errors={errors}
                  watch={watch}
                />

                {/* Expertise (reviewer only) */}
                {isReviewer && expertiseOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Areas of expertise</Label>
                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                      {expertiseOptions.map((exp, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer group">
                          <input type="checkbox" {...register("expertise")} value={exp}
                            className="w-4 h-4 rounded accent-primary" />
                          <span className="group-hover:text-primary transition-colors">{exp}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</>
                  ) : inviteRole === "reviewer"  ? "Register as Reviewer"
                    : inviteRole === "organizer" ? "Register as Editor"
                    : "Create Account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <button
                  onClick={() => navigate(token ? `/login?token=${token}` : "/login")}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in instead
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Register;