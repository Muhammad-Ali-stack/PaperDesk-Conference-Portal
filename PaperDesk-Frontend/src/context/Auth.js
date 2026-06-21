import { useState, useEffect, useContext, createContext, useRef } from "react";
import axios from "axios";

// ── Axios global defaults ────────────────────────────────────
// withCredentials ensures the refreshToken HttpOnly cookie is
// always sent on every request, including cross-origin calls.
axios.defaults.withCredentials = true;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    user: null,
    token: "",
    roles: [],
  });
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // authRef lets the interceptor always read the latest auth
  // state without needing to re-register itself on every render.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // ── Axios auth header ────────────────────────────────────────
  useEffect(() => {
    axios.defaults.headers.common["Authorization"] = auth?.token
      ? `Bearer ${auth.token}`
      : "";
  }, [auth.token]);

  // ── 401 interceptor — retry once after a token refresh ──────
  // This handles the edge case where a 30-day access token has
  // actually expired (e.g. user left a tab open for a month).
  // We do NOT use a polling interval because the token already
  // lasts 30 days — polling would only cause spurious logouts.
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

        // Only intercept 401s that haven't been retried yet.
        if (error.response?.status !== 401 || original._retry) {
          return Promise.reject(error);
        }

        // Never intercept the refresh call itself — that would
        // create an infinite loop.
        if (original.url?.includes("/auth/refresh")) {
          return Promise.reject(error);
        }

        // If a refresh is already in flight, queue this request
        // and resolve it once the refresh completes.
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
          if (!userId) throw new Error("No userId available for refresh.");

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
          // Refresh token itself is expired or invalid.
          // Only now do we log the user out.
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

  // ── Fetch roles from server ──────────────────────────────────
  // silent = true means we already have cached roles and don't
  // want to flash a loading state — we just update in the background.
  const fetchRoles = async (userId, silent = false) => {
    try {
      if (!silent) setRolesLoaded(false);
      const res = await axios.get(`/api/auth/user-roles/${userId}`);
      if (res.status === 200 && res.data.success) {
        const fetchedRoles = res.data.data?.roles || [];
        setAuth((prev) => {
          const updated = { ...prev, roles: fetchedRoles };
          localStorage.setItem("auth", JSON.stringify(updated));
          return updated;
        });
        return fetchedRoles;
      }
    } catch (error) {
      console.error("[AuthContext] Error fetching user roles:", error);
    } finally {
      setRolesLoaded(true);
    }
    return [];
  };

  // ── Hydrate from localStorage on first load ──────────────────
  // We immediately restore the cached session so the UI doesn't
  // flash a logged-out state, then refresh roles from the server
  // in the background to catch any permission changes.
  useEffect(() => {
    const stored = localStorage.getItem("auth");

    if (stored) {
      const parsed = JSON.parse(stored);
      const cachedRoles = parsed.roles || [];
      const hasCachedRoles = cachedRoles.length > 0;

      setAuth({
        user: parsed.user,
        token: parsed.token,
        roles: cachedRoles,
      });

      // If we have cached roles, mark as loaded immediately so
      // the app doesn't block rendering on a network call.
      if (hasCachedRoles) {
        setRolesLoaded(true);
      }

      // Always re-fetch roles from server in the background to
      // stay in sync, but do it silently if we have cached data.
      if (parsed?.user?._id) {
        fetchRoles(parsed.user._id, hasCachedRoles);
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