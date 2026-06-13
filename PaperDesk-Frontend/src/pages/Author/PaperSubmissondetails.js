import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

const PaperSubmissionDetails = () => {
  const [paperDetails, setPaperDetails] = useState(null);
  const [loading, setLoading]           = useState(true);
  const { id } = useParams();

  useEffect(() => {
    axios
      .get(`/api/author/research-paper/${id}`)
      .then((response) => { setPaperDetails(response.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout title="PaperDesk - Paper Details">
        <div className="max-w-4xl mx-auto mt-8 p-6 space-y-5">
          <Skeleton className="h-8 w-56" />
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-5 w-32 mt-4" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!paperDetails) {
    return (
      <Layout title="PaperDesk - Paper Not Found">
        <div className="max-w-4xl mx-auto mt-8 p-6">
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              The requested paper could not be found.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const {
    title,
    abstract,
    keywords,
    paper_authors,
    conference_name,
    conference_acronym,
    created_at,
    paper_file_path,
  } = paperDetails;

  const authors = (paper_authors || []).map((pa) => pa.authors);

  return (
    <Layout title="PaperDesk - Paper Details">
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Submission Details</h2>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              {title}
            </h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><span className="font-semibold text-foreground">Abstract:</span> {abstract}</p>
              <p>
                <span className="font-semibold text-foreground">Keywords:</span>{" "}
                {keywords && (Array.isArray(keywords) ? keywords.join(", ") : keywords)}
              </p>
              <p>
                <span className="font-semibold text-foreground">Conference:</span>{" "}
                {conference_name} {conference_acronym ? `(${conference_acronym})` : ""}
              </p>
              <p>
                <span className="font-semibold text-foreground">Submitted:</span>{" "}
                {created_at ? new Date(created_at).toLocaleString() : "N/A"}
              </p>
              {paper_file_path && (
                <p>
                  <span className="font-semibold text-foreground">File:</span>{" "}
                  <a
                    href={paper_file_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:opacity-80"
                  >
                    Download Paper
                  </a>
                </p>
              )}
            </div>

            {authors.length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-semibold text-foreground mb-2">Authors</h4>
                <ul className="space-y-1">
                  {authors.map((author, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {author?.first_name} {author?.last_name}
                      {author?.email && <span className="ml-1">({author.email})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PaperSubmissionDetails;
