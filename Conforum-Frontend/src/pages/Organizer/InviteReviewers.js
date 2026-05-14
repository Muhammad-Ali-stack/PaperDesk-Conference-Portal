import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Loader2, Mail } from "lucide-react";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";

const InviteReviewers = () => {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [emails, setEmails] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    // Validate conference selection
    if (!conferenceId) {
      toast.error("Please select a conference first.");
      return;
    }
    if (!emails.trim()) {
      toast.error("Please provide at least one email.");
      return;
    }
    const emailList = emails.split(",").map((email) => email.trim()).filter(Boolean);
    if (emailList.length === 0) {
      toast.error("No valid email addresses found.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/email/invite-reviewers", {
        reviewerEmails: emailList,
        conferenceId,
        conferenceName,
        additionalMessage,
      });
      // Backend returns { success, message } or { message }
      if (response.data.success === false) {
        toast.error(response.data.message || "Failed to send invitations.");
      } else {
        toast.success(response.data.message || "Invitations sent successfully.");
        setEmails("");
        setAdditionalMessage("");
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || "Failed to send invitations.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="ConForum - Invite Reviewers">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-2xl mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight">Invite Reviewers</h1>
            {conferenceName && (
              <p className="text-sm text-primary font-medium mt-1">{conferenceName}</p>
            )}
            {!conferenceId && (
              <p className="text-sm text-destructive font-medium mt-1">
                No conference selected. Please select a conference from the sidebar.
              </p>
            )}
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Reviewer Emails</Label>
                <Textarea
                  placeholder="Enter emails separated by commas (e.g. john@uni.edu, jane@research.org)"
                  rows={4}
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
              </div>

              <div className="space-y-1.5">
                <Label>Additional Message (optional)</Label>
                <Textarea
                  placeholder="Add a personal note to your invitation..."
                  rows={3}
                  value={additionalMessage}
                  onChange={(e) => setAdditionalMessage(e.target.value)}
                />
              </div>

              <Button
                onClick={handleInvite}
                disabled={loading || !conferenceId}
                className="w-full"
                size="lg"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending Invitations...</>
                  : <><Mail className="h-4 w-4 mr-2" />Send Invitations</>
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default InviteReviewers;