import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/Auth";
import axios from "axios";
import Layout from "../../components/Layout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

const roleDashboardPaths = {
  organizer: "/userdashboard/organizer-dashboard",
  reviewer: "/userdashboard/reviewer-dashboard",
  author: "/userdashboard/author-dashboard",
};

const RolesPage = () => {
  const [auth] = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.user?._id) {
      setLoading(false);
      return;
    }
    const fetchRoles = async () => {
      try {
        const response = await axios.get(`/api/auth/user-roles/${auth.user._id}`);
        //  Access the nested data.roles
        const fetchedRoles = response.data?.data?.roles ?? [];
        setRoles(fetchedRoles);
      } catch (error) {
        console.error("Error fetching roles:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, [auth?.user?._id]);

  return (
    <Layout title="PaperDesk - My Conferences">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight">My Conferences</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your Conferences</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No roles assigned yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Conference
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {roles.map((roleItem, index) => {
                      const conferenceDisplay = roleItem.awaitingConference
                        ? "Awaiting Conference Assignment"
                        : roleItem.conferenceName || "Unknown Conference";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm font-medium">
                            {conferenceDisplay}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="teal" className="capitalize">
                              {roleItem.role}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RolesPage;