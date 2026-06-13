import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/Auth";
import Layout from "./Layout";
import UserSidebar from "./UserSidebar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Calendar, MapPin, ExternalLink } from "lucide-react";

const ConferencesByRole = ({ role }) => {
  const [auth] = useAuth();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchConferences = useCallback(async () => {
    if (!auth?.user?._id) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/conference/user-conferences/${auth.user._id}/${role}`);
      setConferences(res.data || []);
    } catch (error) {
      console.error("Error fetching conferences:", error);
    } finally {
      setLoading(false);
    }
  }, [auth?.user?._id, role]);

  useEffect(() => {
    fetchConferences();
  }, [fetchConferences]);

  const roleLabel = { organizer: "Editor", reviewer: "Reviewer", author: "Author" }[role] || role;

  const getConfStatus = (conf) => {
    const cutoff = conf.end_date || conf.submission_deadline;
    if (!cutoff) return null;
    return new Date(cutoff) >= new Date() ? "Active" : "Expired";
  };

  return (
    <Layout title={`PaperDesk - ${roleLabel} Conferences`}>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <UserSidebar />
        <div className="flex-1 p-6 lg:p-10 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold tracking-tight">My Conferences</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Conferences where you are a <span className="font-semibold text-primary">{roleLabel}</span>
              </p>
            </div>

            {loading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : conferences.length === 0 ? (
              <Card>
                <CardContent className="p-16 text-center">
                  <p className="text-muted-foreground">No conferences found for this role.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {conferences.map((conf, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="font-bold text-base">{conf.acronym}</h2>
                            <Badge variant="teal" className="text-[10px]">{roleLabel}</Badge>
                            {role === "author" && (() => {
                              const status = getConfStatus(conf);
                              if (!status) return null;
                              return (
                                <Badge
                                  variant={status === "Active" ? "success" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {status}
                                </Badge>
                              );
                            })()}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{conf.conference_name}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {(conf.city || conf.country) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {[conf.city, conf.country].filter(Boolean).join(", ")}
                              </span>
                            )}
                            {conf.start_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {conf.start_date.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/conference/${conf._id || conf.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ConferencesByRole;
