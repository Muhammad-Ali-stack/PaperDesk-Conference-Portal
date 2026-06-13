import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/Auth";

const RolePrivateRoute = ({ role }) => {
  const [auth, , rolesLoaded] = useAuth();

  if (!auth?.token || !auth?.user?._id) {
    return <Navigate to="/login" />;
  }

  if (!rolesLoaded) {
    return <Outlet />;
  }

  const hasRole = auth?.roles?.some((r) => r.role === role);

  if (!hasRole) {
    return <Navigate to="/userdashboard/user-dashboard" />;
  }

  return <Outlet />;
};

export default RolePrivateRoute;
