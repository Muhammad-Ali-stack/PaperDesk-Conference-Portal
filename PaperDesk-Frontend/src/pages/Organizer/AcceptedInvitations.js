import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Users } from "lucide-react";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";

const AcceptedInvitations = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!conferenceId) { 
      setLoading(false); 
      setError("Conference ID is missing."); 
      return; 
    }
    const fetchReviewers = async () => {
      try {
        const response = await axios.get(`/api/reviewer/${conferenceId}/reviewers`);
        setReviewers(response.data.data || []);
      } catch {
        setError("Failed to load reviewers.");
      } finally {
        setLoading(false);
      }
    };
    fetchReviewers();
  }, [conferenceId]);

  return (
    <Layout title="PaperDesk - Accepted Invitations">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
          <div className="max-w-3xl mx-auto w-full">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight">Accepted Invitations</h1>
              {conferenceName && <p className="text-sm text-primary font-medium mt-1">{conferenceName}</p>}
              <p className="text-sm text-muted-foreground mt-1">Reviewers who accepted your conference invitation</p>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : error ? (
              <Card><CardContent className="p-8 text-center text-destructive font-medium">{error}</CardContent></Card>
            ) : reviewers.length === 0 ? (
              <Card><CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No reviewers have accepted yet.</p>
              </CardContent></Card>
            ) : (
              <Card>
                <div className="divide-y">
                  {reviewers.map((reviewer) => (
                    <div key={reviewer.user_id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-semibold text-sm">{reviewer.users?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{reviewer.users?.email || ""}</p>
                      </div>
                      <Badge variant="teal">Reviewer</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
    </Layout>
  );
};

export default AcceptedInvitations;