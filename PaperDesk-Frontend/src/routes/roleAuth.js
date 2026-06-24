import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { Skeleton } from "../components/ui/skeleton";

const RolesSkeleton = () => (
  <div className="min-h-[calc(100vh-4rem)] px-6 py-10 max-w-5xl mx-auto space-y-6">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-72" />
    <div className="space-y-3 pt-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  </div>
);

const RolePrivateRoute = ({ role }) => {
  const [auth, , rolesLoaded, , isInitialized] = useAuth();

  if (!isInitialized) return <RolesSkeleton />;

  if (!auth?.token || !auth?.user?._id) {
    return <Navigate to="/login" replace />;
  }

  if (!rolesLoaded) return <RolesSkeleton />;

  const hasRole = auth?.roles?.some((r) => r.role === role) ?? false;

  if (!hasRole) {
    return <Navigate to="/userdashboard/user-dashboard" replace />;
  }

  return <Outlet />;
};

export default RolePrivateRoute;