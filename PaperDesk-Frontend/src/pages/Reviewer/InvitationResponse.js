import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

const InvitationResponse = () => {
  const [searchParams] = useSearchParams();
  const conferenceName = searchParams.get("conferenceName");
  const conferenceId = searchParams.get("conferenceId");
  const email = searchParams.get("email");
  const navigate = useNavigate();

  const handleResponse = async (status) => {
    try {
      await axios.post("/api/reviewer/respond-invitation", {
        conferenceId,
        status,
      });

      if (status === "accepted") {
        navigate(
          `/register?role=reviewer&conferenceId=${conferenceId}&conferenceName=${encodeURIComponent(conferenceName)}&email=${encodeURIComponent(email)}`
        );
      } else {
        navigate(
          `/thankyou?status=${status}&conferenceName=${encodeURIComponent(conferenceName)}&conferenceId=${conferenceId}`
        );
      }
    } catch (error) {
      console.error("Error submitting response:", error);
    }
  };

  return (
    <Layout title="PaperDesk - Invitation Response">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Conference Invitation
            </h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              You have been invited to review papers for{" "}
              <span className="font-semibold text-foreground">{conferenceName}</span>.
              Would you like to accept or decline this invitation?
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => handleResponse("accepted")}
                className="flex items-center gap-2 flex-1"
                size="lg"
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResponse("declined")}
                className="flex items-center gap-2 flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                size="lg"
              >
                <XCircle className="h-4 w-4" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default InvitationResponse;
