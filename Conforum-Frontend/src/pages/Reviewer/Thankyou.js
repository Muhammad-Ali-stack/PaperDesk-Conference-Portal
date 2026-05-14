import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

const ThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const conferenceName = searchParams.get("conferenceName");
  const conferenceId = searchParams.get("conferenceId");
  const status = searchParams.get("status");
  const navigate = useNavigate();

  const accepted = status === "accepted";

  return (
    <Layout title="ConForum - Response">
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-lg animate-fade-in">
          <CardContent className="p-10 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${accepted ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              {accepted
                ? <CheckCircle className="h-8 w-8 text-green-600" />
                : <XCircle className="h-8 w-8 text-red-500" />
              }
            </div>
            <h1 className="text-2xl font-extrabold mb-3">
              {accepted ? "Invitation Accepted" : "Invitation Declined"}
            </h1>
            {conferenceName && (
              <p className="text-muted-foreground text-sm mb-6">
                {accepted
                  ? `You are now a reviewer for ${conferenceName}.`
                  : `You have declined the invitation for ${conferenceName}.`
                }
              </p>
            )}
            <div className="flex flex-col gap-3">
              {accepted && conferenceId && (
                <Button onClick={() => navigate(`/conference/${conferenceId}`)}>
                  View Conference
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ThankYouPage;
