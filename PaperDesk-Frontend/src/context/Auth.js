import { useState, useEffect, useContext, createContext, useRef } from "react";
import axios from "axios";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    user: null,
    token: "",
    roles: [],
  });
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const authRef = useRef(auth);

  // Keep ref in sync with state
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // Set axios default header when auth.token changes
  useEffect(() => {
    axios.defaults.headers.common["Authorization"] = auth?.token
      ? `Bearer ${auth.token}`
      : "";
  }, [auth.token]);

  // ── Refresh interceptor (registered once on mount) ──────────
  useEffect(() => {
    let isRefreshing = false;
    let failedQueue = [];

    const processQueue = (error, token = null) => {
      failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
      failedQueue = [];
    };

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;

        if (error.response?.status !== 401 || original._retry) {
          return Promise.reject(error);
        }

        // Don't intercept the refresh call itself
        if (original.url?.includes("/auth/refresh")) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) =>
            failedQueue.push({ resolve, reject })
          ).then((token) => {
            original.headers["Authorization"] = `Bearer ${token}`;
            return axios(original);
          });
        }

        original._retry = true;
        isRefreshing = true;

        try {
          const userId = authRef.current?.user?._id;
          if (!userId) throw new Error("No user id");

          const { data } = await axios.post("/api/auth/refresh", { userId });
          const newToken = data.data.token;
          const newUser = data.data.user;
          const newRoles = data.data.roles;

          setAuth((prev) => {
            const updated = {
              ...prev,
              token: newToken,
              user: newUser ?? prev.user,
              roles: newRoles ?? prev.roles,
            };
            localStorage.setItem("auth", JSON.stringify(updated));
            return updated;
          });

          axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
          original.headers["Authorization"] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return axios(original);
        } catch (refreshError) {
          processQueue(refreshError, null);
          setAuth({ user: null, token: "", roles: [] });
          localStorage.removeItem("auth");
          delete axios.defaults.headers.common["Authorization"];
          window.location.href = "/login";
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    );

    return () => axios.interceptors.response.eject(interceptorId);
  }, []);

  const fetchRoles = async (userId, silent = false) => {
    try {
      if (!silent) setRolesLoaded(false);
      const res = await axios.get(`/api/auth/user-roles/${userId}`);
      if (res.status === 200 && res.data.success) {
        const fetchedRoles = res.data.data?.roles || [];
        setAuth((prev) => {
          const updatedAuth = {
            ...prev,
            roles: fetchedRoles,
          };
          localStorage.setItem("auth", JSON.stringify(updatedAuth));
          return updatedAuth;
        });
        return fetchedRoles;
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    } finally {
      setRolesLoaded(true);
    }
    return [];
  };

  useEffect(() => {
    const data = localStorage.getItem("auth");
    if (data) {
      const parseData = JSON.parse(data);
      const cachedRoles = parseData.roles || [];
      const hasCachedRoles = cachedRoles.length > 0;

      setAuth({
        user: parseData.user,
        token: parseData.token,
        roles: cachedRoles,
      });

      if (hasCachedRoles) {
        setRolesLoaded(true);
      }

      if (parseData?.user?._id) {
        fetchRoles(parseData.user._id, hasCachedRoles);
      } else {
        setRolesLoaded(true);
      }
    } else {
      setRolesLoaded(true);
    }
  }, []);

  return (
    <AuthContext.Provider value={[auth, setAuth, rolesLoaded, fetchRoles]}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

export { useAuth, AuthProvider };