import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";
import { Skeleton } from "../../components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { FileText, CheckCircle, XCircle, Clock, Send, AlertTriangle } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, colorClass, loading }) => (
  <Card>
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorClass} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <>
            <Skeleton className="h-7 w-10 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-2xl font-extrabold text-foreground leading-none">{value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight">{label}</p>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

const CSSDonut = ({ segments, size = 100 }) => {
  const nonZero = segments.filter(s => s.pct > 0);
  if (nonZero.length === 0) {
    return (
      <div
        className="rounded-full bg-muted flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
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

const ProgressBar = ({ label, value, max, color, textColor }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const AuthorDashboard = () => {
  const [auth] = useAuth();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const res = await axios.get("/api/author/all-research-papers");
        setPapers(res.data?.data?.papers ?? []);
      } catch (err) {
        console.error("Author dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPapers();
  }, []);

  const total       = papers.length;
  const accepted    = papers.filter(p => (p.final_decision || "").toLowerCase() === "accepted").length;
  const rejected    = papers.filter(p => (p.final_decision || "").toLowerCase() === "rejected").length;
  const modRequired = papers.filter(p => (p.final_decision || "").toLowerCase() === "modification required").length;
  const underReview = papers.filter(p => {
    const s = (p.status || "").toLowerCase();
    const d = (p.final_decision || "").toLowerCase();
    return (s === "under_review" || s === "assigned" || s === "reviewed") && !d;
  }).length;
  const pending = Math.max(0, total - accepted - rejected - modRequired - underReview);

  const donutSegments = [
    { color: "#10b981", pct: total > 0 ? (accepted    / total) * 100 : 0, label: "Accepted"          },
    { color: "#ef4444", pct: total > 0 ? (rejected    / total) * 100 : 0, label: "Rejected"          },
    { color: "#f59e0b", pct: total > 0 ? (modRequired / total) * 100 : 0, label: "Mod. Required"     },
    { color: "#6366f1", pct: total > 0 ? (underReview / total) * 100 : 0, label: "Under Review"      },
    { color: "#94a3b8", pct: total > 0 ? (pending     / total) * 100 : 0, label: "Pending"           },
  ];

  return (
    <Layout title="PaperDesk - Author Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-7">

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[200px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1532614338840-ab30cf10ed36?q=80&w=2070&auto=format&fit=crop"
              alt="Author researching academic papers"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-12 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-4 border border-white/20">
                Researcher
              </span>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
                Author <span className="text-teal-300">Dashboard</span>
              </h1>
              <p className="text-sm lg:text-base text-white/70 font-medium leading-relaxed">
                Track your research submissions, respond to reviewer feedback, and manage your academic publications.
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={FileText}      label="Total Submitted"   value={total}       colorClass="bg-slate-500"    loading={loading} />
            <StatCard icon={CheckCircle}   label="Accepted"          value={accepted}    colorClass="bg-emerald-500"  loading={loading} />
            <StatCard icon={XCircle}       label="Rejected"          value={rejected}    colorClass="bg-red-500"      loading={loading} />
            <StatCard icon={Clock}         label="Under Review"      value={underReview} colorClass="bg-indigo-500"   loading={loading} />
            <StatCard icon={AlertTriangle} label="Mod. Required"     value={modRequired} colorClass="bg-amber-500"    loading={loading} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Donut breakdown */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Submission Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex items-center gap-6">
                {loading ? (
                  <>
                    <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-3 w-full" />)}
                    </div>
                  </>
                ) : total === 0 ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Send className="h-8 w-8 opacity-30" />
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

            {/* Progress bars */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Decision Progress</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : total === 0 ? (
                  <p className="text-sm text-muted-foreground">Submit papers to see progress.</p>
                ) : (
                  <>
                    <ProgressBar label="Accepted"       value={accepted}    max={total} color="bg-emerald-500" textColor="text-emerald-600 dark:text-emerald-400" />
                    <ProgressBar label="Under Review"   value={underReview} max={total} color="bg-indigo-500"  textColor="text-indigo-600 dark:text-indigo-400" />
                    <ProgressBar label="Rejected"       value={rejected}    max={total} color="bg-red-500"     textColor="text-red-600 dark:text-red-400" />
                    {modRequired > 0 && (
                      <ProgressBar label="Mod. Required" value={modRequired} max={total} color="bg-amber-500"   textColor="text-amber-600 dark:text-amber-400" />
                    )}
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                      {total} total paper{total !== 1 ? "s" : ""} across all conferences.
                    </p>
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

export default AuthorDashboard;
