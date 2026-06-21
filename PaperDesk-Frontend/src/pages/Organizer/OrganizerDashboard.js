import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import { Skeleton } from "../../components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { FileText, CheckCircle2, XCircle, Clock, Users, Star, AlertTriangle } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, accentClass, iconClass, loading }) => (
  <Card className="border-border/60">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${accentClass}`}>
        <Icon className={`h-[18px] w-[18px] ${iconClass}`} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <>
            <Skeleton className="h-7 w-10 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1 leading-tight">{label}</p>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

const CSSDonut = ({ segments, size = 96 }) => {
  const nonZero = segments.filter(s => s.pct > 0);
  if (nonZero.length === 0) {
    return <div className="rounded-full bg-muted flex-shrink-0" style={{ width: size, height: size }} />;
  }
  let cumulative = 0;
  const gradientParts = nonZero.map(seg => {
    const start = cumulative;
    cumulative += seg.pct;
    return `${seg.color} ${start}% ${cumulative}%`;
  });
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        style={{
          background: `conic-gradient(${gradientParts.join(", ")})`,
          borderRadius: "50%",
          width: size,
          height: size,
        }}
      />
      <div
        className="absolute bg-card rounded-full"
        style={{
          width: size * 0.58,
          height: size * 0.58,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
};

const ProgressBar = ({ label, value, max, color, textColor, sub }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
};

const OrganizerDashboard = () => {
  const { conferenceId, conferenceName, loading: confLoading } = useOrganizerConference();
  const [papers, setPapers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conferenceId) { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const [papersRes, reviewersRes] = await Promise.all([
          axios.get(`/api/organizer/review-management/${conferenceId}`),
          axios.get(`/api/reviewer/${conferenceId}/reviewers`),
        ]);
        setPapers(papersRes.data?.data ?? []);
        setReviewers(reviewersRes.data?.data ?? []);
      } catch (err) {
        console.error("Organizer dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [conferenceId]);

  const isLoading = loading || confLoading;

  const total       = papers.length;
  const accepted    = papers.filter(p => (p.final_decision || "").toLowerCase() === "accepted").length;
  const rejected    = papers.filter(p => (p.final_decision || "").toLowerCase() === "rejected").length;
  const modRequired = papers.filter(p => (p.final_decision || "").toLowerCase() === "modification required").length;
  const underReview = papers.filter(p => {
    const s = (p.status || "").toLowerCase();
    return s === "under_review" || s === "assigned" || s === "reviewed";
  }).length;
  const undecided   = Math.max(0, total - accepted - rejected - modRequired);

  const totalReviewsSubmitted = papers.reduce((acc, p) => acc + (p.reviews_submitted || 0), 0);
  const totalReviewsRequired  = papers.reduce((acc, p) => acc + (p.reviews_total  || 0), 0);

  const donutSegments = [
    { color: "#10b981", pct: total > 0 ? (accepted    / total) * 100 : 0, label: "Accepted"      },
    { color: "#ef4444", pct: total > 0 ? (rejected    / total) * 100 : 0, label: "Rejected"      },
    { color: "#f59e0b", pct: total > 0 ? (modRequired / total) * 100 : 0, label: "Mod. Required" },
    { color: "#6366f1", pct: total > 0 ? (underReview / total) * 100 : 0, label: "Under Review"  },
    { color: "#94a3b8", pct: total > 0 ? (Math.max(0, undecided - underReview - modRequired) / total) * 100 : 0, label: "Pending" },
  ];

  return (
    <Layout title="PaperDesk - Editor Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-7">

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[200px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2069&auto=format&fit=crop"
              alt="Conference editor planning"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-12 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-4 border border-white/20">
                Conference Manager
              </span>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-2">
                Editor <span className="text-teal-300">Portal</span>
              </h1>
              {conferenceName && (
                <p className="text-teal-200 font-semibold text-sm mb-2">{conferenceName}</p>
              )}
              <p className="text-sm text-white/70 font-medium leading-relaxed">
                Orchestrate world-class academic events. Manage registrations, review assignments, and paper decisions.
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              icon={FileText}
              label="Total Papers"
              value={total}
              accentClass="bg-slate-100 dark:bg-slate-800"
              iconClass="text-slate-600 dark:text-slate-300"
              loading={isLoading}
            />
            <StatCard
              icon={CheckCircle2}
              label="Accepted"
              value={accepted}
              accentClass="bg-emerald-50 dark:bg-emerald-950/40"
              iconClass="text-emerald-600 dark:text-emerald-400"
              loading={isLoading}
            />
            <StatCard
              icon={XCircle}
              label="Rejected"
              value={rejected}
              accentClass="bg-red-50 dark:bg-red-950/40"
              iconClass="text-red-600 dark:text-red-400"
              loading={isLoading}
            />
            <StatCard
              icon={Clock}
              label="Under Review"
              value={underReview}
              accentClass="bg-indigo-50 dark:bg-indigo-950/40"
              iconClass="text-indigo-600 dark:text-indigo-400"
              loading={isLoading}
            />
            <StatCard
              icon={Users}
              label="Reviewers"
              value={reviewers.length}
              accentClass="bg-teal-50 dark:bg-teal-950/40"
              iconClass="text-teal-600 dark:text-teal-400"
              loading={isLoading}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Donut: paper decisions */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Paper Decision Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex items-center gap-6">
                {isLoading ? (
                  <>
                    <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-3 w-full" />)}
                    </div>
                  </>
                ) : !conferenceId ? (
                  <p className="text-sm text-muted-foreground">No conference selected.</p>
                ) : total === 0 ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-30" strokeWidth={1.5} />
                    <p className="text-sm">No papers submitted yet.</p>
                  </div>
                ) : (
                  <>
                    <CSSDonut segments={donutSegments} size={96} />
                    <div className="space-y-2 flex-1 text-xs">
                      {donutSegments.filter(s => s.pct > 0).map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-muted-foreground flex-1">{s.label}</span>
                          <span className="font-semibold text-foreground">{Math.round(s.pct)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Review progress */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Review Progress</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : !conferenceId ? (
                  <p className="text-sm text-muted-foreground">No conference selected.</p>
                ) : (
                  <>
                    <ProgressBar
                      label="Reviews Submitted"
                      value={totalReviewsSubmitted}
                      max={totalReviewsRequired || 1}
                      color="bg-emerald-500"
                      textColor="text-emerald-600 dark:text-emerald-400"
                      sub={`${totalReviewsSubmitted} of ${totalReviewsRequired} reviews completed`}
                    />
                    <ProgressBar
                      label="Papers Decided"
                      value={accepted + rejected + modRequired}
                      max={total || 1}
                      color="bg-teal-500"
                      textColor="text-teal-600 dark:text-teal-400"
                      sub={`${accepted + rejected + modRequired} of ${total} papers have a final decision`}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs pt-1 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.75} />
                        <span className="text-muted-foreground">{totalReviewsSubmitted} reviews in</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
                        <span className="text-muted-foreground">{Math.max(0, totalReviewsRequired - totalReviewsSubmitted)} pending</span>
                      </div>
                      {modRequired > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
                          <span className="text-muted-foreground">{modRequired} mod. required</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrganizerDashboard;