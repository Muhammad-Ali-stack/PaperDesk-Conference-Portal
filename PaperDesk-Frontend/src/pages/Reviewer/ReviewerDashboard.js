import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";
import { Skeleton } from "../../components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { FileText, CheckSquare, Clock, ListChecks } from "lucide-react";

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
            <Skeleton className="h-3 w-24" />
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

const ProgressBar = ({ label, pct, color, textColor, sub }) => (
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

const ReviewerDashboard = () => {
  const [auth] = useAuth();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = auth?.user?._id || auth?.user?.id;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchPapers = async () => {
      try {
        const res = await axios.get(`/api/reviewer/assigned-papers/reviewer/${userId}`);
        setPapers(res.data?.data ?? []);
      } catch (err) {
        console.error("Reviewer dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPapers();
  }, [userId]);

  const total    = papers.length;
  const reviewed = papers.filter(p => p.isReviewedBy === true).length;
  const pending  = total - reviewed;
  const completionPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  // Group by conference
  const byConference = papers.reduce((acc, p) => {
    const key = p.conferenceName || p.conferenceAcronym || "Unknown Conference";
    if (!acc[key]) acc[key] = { total: 0, reviewed: 0 };
    acc[key].total++;
    if (p.isReviewedBy) acc[key].reviewed++;
    return acc;
  }, {});

  const confEntries = Object.entries(byConference);

  return (
    <Layout title="PaperDesk - Reviewer Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-7">

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[200px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2070&auto=format&fit=crop"
              alt="Reviewer reading and evaluating academic papers"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-12 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-4 border border-white/20">
                Expert Evaluator
              </span>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
                Reviewer <span className="text-teal-300">Space</span>
              </h1>
              <p className="text-sm lg:text-base text-white/70 font-medium leading-relaxed">
                Contribute to the advancement of science. Evaluate assigned manuscripts, provide expert feedback, and shape your field.
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={FileText}   label="Total Assigned"    value={total}    colorClass="bg-slate-500"    loading={loading} />
            <StatCard icon={CheckSquare} label="Reviews Completed" value={reviewed} colorClass="bg-emerald-500"  loading={loading} />
            <StatCard icon={Clock}      label="Pending Reviews"   value={pending}  colorClass="bg-amber-500"    loading={loading} />
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Overall completion */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Overall Completion</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : total === 0 ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <ListChecks className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No papers assigned yet.</p>
                  </div>
                ) : (
                  <>
                    <ProgressBar
                      label="Completed"
                      pct={completionPct}
                      color="bg-emerald-500"
                      textColor="text-emerald-600 dark:text-emerald-400"
                      sub={`${reviewed} paper${reviewed !== 1 ? "s" : ""} reviewed`}
                    />
                    {pending > 0 && (
                      <ProgressBar
                        label="Pending"
                        pct={100 - completionPct}
                        color="bg-amber-400"
                        textColor="text-amber-600 dark:text-amber-400"
                        sub={`${pending} paper${pending !== 1 ? "s" : ""} still need review`}
                      />
                    )}
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                      {total} paper{total !== 1 ? "s" : ""} assigned across all conferences.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* By conference */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Progress by Conference</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-full rounded-full" />
                    </div>
                  ))
                ) : confEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments yet.</p>
                ) : (
                  confEntries.map(([conf, stats]) => {
                    const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
                    return (
                      <div key={conf}>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-muted-foreground truncate max-w-[200px]">{conf}</span>
                          <span className="font-semibold text-foreground ml-2 flex-shrink-0">
                            {stats.reviewed}/{stats.total}
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewerDashboard;
