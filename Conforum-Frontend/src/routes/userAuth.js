import { useEffect, useRef } from "react";
import { useAuth } from "../context/Auth";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

export default function UserPrivateRoute() {
  const [auth, setAuth] = useAuth();
  const navigate = useNavigate();
  const verified = useRef(false);

  useEffect(() => {
    if (!auth?.token || verified.current) return;

    const authCheck = async () => {
      try {
        const res = await axios.get("/api/auth/user-auth", {
          // FIX: Add "Bearer " prefix to the Authorization header
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (res.data.ok) {
          verified.current = true;
        } else {
          setAuth({ user: null, token: "" });
          localStorage.removeItem("auth");
          navigate("/login");
        }
      } catch (error) {
        if (error.response?.data?.name === "TokenExpiredError") {
          toast.error("Your session has expired. Please sign in again.");
        } else {
          toast.error("Your session could not be verified. Please sign in again.");
        }
        setAuth({ user: null, token: "" });
        localStorage.removeItem("auth");
        navigate("/login");
      }
    };

    authCheck();
  }, [auth?.token, setAuth, navigate]);

  if (!auth?.token) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}