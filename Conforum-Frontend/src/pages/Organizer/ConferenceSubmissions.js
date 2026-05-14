import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

const ConferencePapers = () => {
  const { id } = useParams();
  const [papers, setPapers] = useState([]);
  const [conferenceName, setConferenceName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConferenceData = async () => {
      try {
        const response = await axios.get(`/api/conference/get-conference/${id}`);
        const conference = response.data;
        setConferenceName(conference?.conference_name || "");
        setPapers(conference?.papers || []);
      } catch (error) {
        console.error("Error fetching conference data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchConferenceData();
  }, [id]);

  return (
    <Layout title="ConForum - Submissions">
      <div className="min-h-screen bg-background px-4 py-8 max-w-screen-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {loading ? <Skeleton className="h-8 w-64 inline-block" /> : (conferenceName || "Conference")}
          </h1>
          <p className="text-muted-foreground mt-1">Paper Submissions</p>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Keywords</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Authors</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Submitted</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : papers.length > 0 ? (
                  papers.map((paper, index) => (
                    <tr key={paper.id || index} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-muted-foreground">{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium">{paper.title || "-"}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {paper.keywords?.length
                            ? paper.keywords.map((k, ki) => (
                                <Badge key={ki} variant="secondary" className="text-xs">{k}</Badge>
                              ))
                            : <span className="text-muted-foreground">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {paper.paper_authors?.length ? (
                          paper.paper_authors.map((pa, i) => (
                            <div key={i} className="text-sm">
                              <span className="font-medium">{pa.authors?.first_name || "Unknown"}</span>{" "}
                              <span className="text-muted-foreground text-xs">
                                ({pa.authors?.email || "No Email"})
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {paper.created_at ? new Date(paper.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {paper.paper_file_path ? (
                          <a
                            href={paper.paper_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            View Paper
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                      No papers found for this conference.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default ConferencePapers;
