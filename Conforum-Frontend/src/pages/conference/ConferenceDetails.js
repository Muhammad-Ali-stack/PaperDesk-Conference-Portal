import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/Auth";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { Calendar, MapPin, Globe, FileText } from "lucide-react";

const ConferenceDetailsPage = () => {
  const { id } = useParams();
  const [conference, setConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auth] = useAuth();
  const navigate = useNavigate();

  const isAuthor = auth?.roles?.some((r) => r.role === "author" && r.conferenceId === id);

  useEffect(() => {
    if (!id) return;
    const fetchConferenceDetails = async () => {
      try {
        const response = await axios.get(`/api/conference/get-conference/${id}`);
        setConference(response.data);
      } catch (error) {
        console.error("Error fetching conference details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConferenceDetails();
  }, [id]);

  const safeDate = (val) => {
    if (!val) return "-";
    const d = new Date(val);
    return isNaN(d) ? "-" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!conference) {
    return <p className="text-center text-muted-foreground py-12">Conference not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">{conference.conference_name}</h1>
        <div className="flex flex-wrap gap-2">
          {conference.acronym && <Badge variant="teal">{conference.acronym}</Badge>}
          <Badge variant={conference.status === "approved" ? "success" : "warning"} className="capitalize">
            {conference.status || "pending"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {[
          {
            icon: MapPin,
            label: "Location",
            value: [conference.venue, conference.city, conference.country].filter(Boolean).join(", ") || "-",
          },
          {
            icon: Calendar,
            label: "Dates",
            value: `${safeDate(conference.start_date)} — ${safeDate(conference.end_date)}`,
          },
          {
            icon: FileText,
            label: "Submission Deadline",
            value: safeDate(conference.submission_deadline),
          },
          {
            icon: Globe,
            label: "Mode",
            value: conference.mode || "-",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="font-semibold text-sm mt-0.5">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(conference.topics?.filter((t) => t?.trim()).length > 0 ||
        conference.expertise?.filter((e) => e?.trim()).length > 0) && (
        <Card className="mb-6">
          <CardContent className="p-6">
            {conference.topics?.filter((t) => t?.trim()).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Topics</p>
                <div className="flex flex-wrap gap-2">
                  {conference.topics
                    .filter((t) => t?.trim())
                    .map((topic, i) => (
                      <Badge key={i} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
            {conference.expertise?.filter((e) => e?.trim()).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Required Expertise
                </p>
                <div className="flex flex-wrap gap-2">
                  {conference.expertise
                    .filter((e) => e?.trim())
                    .map((exp, i) => (
                      <Badge key={i} variant="outline">
                        {exp}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAuthor && conference.status === "approved" && (
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/conference/${conference.acronym}/submit-paper/${id}`)}>
            <FileText className="h-4 w-4 mr-2" />
            Submit Paper
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConferenceDetailsPage;
