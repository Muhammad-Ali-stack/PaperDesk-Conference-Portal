import { useState, useEffect } from "react";
import { useAuth } from "../context/Auth";
import { Outlet, useNavigate } from "react-router-dom";
import axios from "axios";
import LoadingSpinner from "../components/LoadingSpinner";
import toast from "react-hot-toast";

export default function AdminPrivateRoute() {
  const [ok, setOk] = useState(false);
  const [auth, setAuth] = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const authCheck = async () => {
      try {
        const res = await axios.get("/api/auth/admin-auth");
        if (res.data.ok) {
          setOk(true);
        } else {
          setOk(false);
        }
      } catch (error) {
        console.log("AdminPrivateRoute error:", error?.response?.data);

        if (
          error?.response?.status === 401 &&
          error?.response?.data?.name === "TokenExpiredError"
        ) {
          toast.error("Your session has expired, kindly login again");
          setAuth({ user: null, token: "", roles: [] });
          localStorage.removeItem("auth");
          navigate("/login");
        } else {
          setOk(false);
        }
      }
    };

    if (auth?.token) authCheck();
  }, [auth?.token, setAuth, navigate]);

  return ok ? <Outlet /> : <LoadingSpinner fullPage />;
}
