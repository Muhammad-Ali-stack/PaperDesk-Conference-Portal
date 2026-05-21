import { useEffect, useState } from "react";
import axios from "axios";
import { useOrganizerConference } from "../../context/OrganizerConferenceContext";
import Layout from "../../components/Layout";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FileText } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";

export default function ConferencePapersDecisions() {
  const { conferenceId, conferenceName } = useOrganizerConference();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const res = await axios.get(`/api/conference/${conferenceId}/papers`);
        setPapers(res.data.papers);
      } catch (err) {
        console.error("Error fetching papers", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPapers();
  }, [conferenceId]);

  const categories = [
    "ALL",
    "ACCEPTED",
    "PENDING",
    "REJECTED",
    "MODIFICATION REQUIRED",
  ];

  const groupedPapers = papers.reduce((acc, paper) => {
    const status = paper.final_decision?.toUpperCase() || "PENDING";
    if (!acc[status]) acc[status] = [];
    acc[status].push(paper);
    return acc;
  }, {});

  const filteredPapers =
    selectedCategory === "ALL" ? papers : groupedPapers[selectedCategory] || [];

  //  MATCHES REAL TABLE STRUCTURE EXACTLY
  const TableSkeleton = () => (
    <Card className="mb-8 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 dark:bg-muted/20">
                {["S.No", "Title", "Keywords", "Authors", "Reviewers", "Paper", "Final Decision"].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="px-6 py-4"><Skeleton className="h-4 w-6" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-6 py-4 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const CategorySkeleton = () => (
    <div className="flex flex-wrap gap-2 mb-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );

  const renderTable = (papersList) => (
    <Card className="mb-8 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 dark:bg-muted/20">
                {["S.No", "Title", "Keywords", "Authors", "Reviewers", "Paper", "Final Decision"].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {papersList.length > 0 ? (
                papersList.map((paper, idx) => {
                  let reviewerNames = "N/A";

                  if (paper.reviews) {
                    reviewerNames = paper.reviews
                      .map(r => r.reviewerId?.name || r.reviewer?.name || "-")
                      .join(", ");
                  }

                  return (
                    <tr key={paper._id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">{idx + 1}</td>
                      <td className="px-6 py-4 font-medium">{paper.title}</td>
                      <td className="px-6 py-4">
                        {paper.keywords?.join(", ") || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        {paper.authors?.map((a, i) => (
                          <div key={i}>
                            {a.firstName} ({a.email})
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4">{reviewerNames}</td>
                      <td className="px-6 py-4">
                        <a
                          href={paper.paper_file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          View PDF
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            paper.final_decision === "Accepted"
                              ? "success"
                              : paper.final_decision === "Rejected"
                              ? "destructive"
                              : paper.final_decision === "Modification Required"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {paper.final_decision || "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    No papers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout title="PaperDesk - Papers Decisions">
        <div className="flex-1 p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            <Skeleton className="h-8 w-80 mb-2" />
            <Skeleton className="h-4 w-60 mb-6" />

            <CategorySkeleton />
            <TableSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="PaperDesk - Papers Decisions">
      <div className="flex-1 p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-extrabold mb-1">
            {conferenceName} - Submitted Papers
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Summary of Submitted Papers and their Final Decisions
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>

          {selectedCategory === "ALL"
            ? categories.slice(1).map(
                (category) =>
                  groupedPapers[category] && (
                    <div key={category}>
                      <h2 className="text-xl font-semibold mb-3">
                        {category}
                      </h2>
                      {renderTable(groupedPapers[category])}
                    </div>
                  )
              )
            : renderTable(filteredPapers)}
        </div>
      </div>
    </Layout>
  );
}