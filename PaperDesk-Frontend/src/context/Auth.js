import { useState, useEffect, useContext, createContext, useRef, useCallback } from "react";
import axios from "axios";

// ── Axios global defaults ────────────────────────────────────
// withCredentials ensures the refreshToken HttpOnly cookie is
// always sent on every request, including cross-origin calls.
axios.defaults.withCredentials = true;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    user:  null,
    token: "",
    roles: [],
  });

  // isInitialized: false until the boot-time refresh attempt
  // completes (success or failure). Children should not render
  // protected content until this is true.
  const [isInitialized, setIsInitialized] = useState(false);
  const [rolesLoaded, setRolesLoaded]     = useState(false);

  // authRef lets the interceptor always read the latest auth
  // without needing to re-register on every render.
  const authRef = useRef(auth);
  useEffect(() => { authRef.current = auth; }, [auth]);

  // initRefreshInFlight: prevents the 401 interceptor from
  // firing a *second* refresh while the boot-time refresh is
  // already running. Without this, a race on first load can
  // cause two simultaneous /refresh calls.
  const initRefreshInFlight = useRef(false);

  // ── Axios auth header ──────────────────────────────────────
  useEffect(() => {
    axios.defaults.headers.common["Authorization"] = auth?.token
      ? `Bearer ${auth.token}`
      : "";
  }, [auth.token]);

  // ── Fetch roles from server ────────────────────────────────
  // silent = true → we already have cached roles and just want
  // to sync in the background without a loading flash.
  const fetchRoles = useCallback(async (userId, silent = false) => {
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
    } catch (err) {
      console.error("[AuthContext] Error fetching user roles:", err);
    } finally {
      setRolesLoaded(true);
    }
    return [];
  }, []);

  // ── 401 interceptor ────────────────────────────────────────
  // Retries a failed request once after silently refreshing the
  // access token. Queues concurrent failures so only one refresh
  // call goes out regardless of how many requests 401 at once.
  useEffect(() => {
    let isRefreshing = false;
    let failedQueue  = [];

    const processQueue = (error, token = null) => {
      failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
      failedQueue = [];
    };

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;

        // Only handle 401s that haven't been retried.
        if (error.response?.status !== 401 || original._retry) {
          return Promise.reject(error);
        }

        // Never intercept these endpoints — avoids infinite loops.
        if (
          original.url?.includes("/auth/refresh")    ||
          original.url?.includes("/auth/login")       ||
          original.url?.includes("/auth/verify-otp")  ||
          original.url?.includes("/auth/register")
        ) {
          return Promise.reject(error);
        }

        // Don't fire a second refresh while the boot-time
        // silent refresh is already running.
        if (initRefreshInFlight.current) {
          return Promise.reject(error);
        }

        // Queue concurrent 401s behind a single refresh call.
        if (isRefreshing) {
          return new Promise((resolve, reject) =>
            failedQueue.push({ resolve, reject })
          ).then((token) => {
            original.headers["Authorization"] = `Bearer ${token}`;
            return axios(original);
          });
        }

        original._retry = true;
        isRefreshing    = true;

        try {
          const userId = authRef.current?.user?._id;
          if (!userId) throw new Error("No userId for refresh.");

          const { data } = await axios.post("/api/auth/refresh", { userId });
          const newToken = data.data.token;
          const newUser  = data.data.user;
          const newRoles = data.data.roles;

          setAuth((prev) => {
            const updated = {
              ...prev,
              token: newToken,
              user:  newUser  ?? prev.user,
              roles: newRoles ?? prev.roles,
            };
            localStorage.setItem("auth", JSON.stringify(updated));
            return updated;
          });

          axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
          original.headers["Authorization"]              = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return axios(original);
        } catch (refreshError) {
          // Refresh token expired/invalid — log the user out.
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

  // ── Boot-time hydration + silent refresh ──────────────────
  //
  // The reload-logout bug happened because:
  //   1. localStorage had an expired access token.
  //   2. The app restored it and immediately made API calls.
  //   3. Those calls 401'd and the interceptor tried to refresh,
  //      racing against itself.
  //
  // Fix:
  //   1. Restore cached state immediately (no UI flash).
  //   2. Set initRefreshInFlight = true so the 401 interceptor
  //      stands down while we do the boot refresh.
  //   3. Call /refresh once to get a guaranteed-fresh token.
  //   4. Only set isInitialized = true after step 3 completes,
  //      so route guards don't render protected content with a
  //      stale or missing token.
  //   5. If refresh fails, clear state and let route guards
  //      redirect — we don't force /login here so public pages
  //      aren't affected.
  useEffect(() => {
    const boot = async () => {
      const stored = localStorage.getItem("auth");

      if (!stored) {
        setIsInitialized(true);
        setRolesLoaded(true);
        return;
      }

      const parsed         = JSON.parse(stored);
      const cachedRoles    = parsed.roles || [];
      const hasCachedRoles = cachedRoles.length > 0;
      const userId         = parsed?.user?._id;

      // Step 1: restore cached state immediately so the UI
      // doesn't flash as logged-out during the refresh call.
      setAuth({
        user:  parsed.user,
        token: parsed.token,
        roles: cachedRoles,
      });

      if (hasCachedRoles) setRolesLoaded(true);

      if (!userId) {
        setIsInitialized(true);
        setRolesLoaded(true);
        return;
      }

      // Step 2: lock out the 401 interceptor while we refresh.
      initRefreshInFlight.current = true;

      try {
        // Step 3: exchange the HttpOnly refresh cookie for a
        // fresh access token. This is the key fix — even if the
        // localStorage token is expired, the cookie keeps users
        // logged in for 30 days after their last activity.
        const { data } = await axios.post("/api/auth/refresh", { userId });
        const newToken = data.data.token;
        const newUser  = data.data.user;
        const newRoles = data.data.roles;

        const updated = {
          user:  newUser  ?? parsed.user,
          token: newToken,
          roles: newRoles ?? cachedRoles,
        };

        setAuth(updated);
        localStorage.setItem("auth", JSON.stringify(updated));
        axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

        // Sync roles silently in the background.
        fetchRoles(userId, true);
      } catch {
        // Refresh cookie expired or invalid — clear everything.
        // Don't redirect here; public pages should still render.
        setAuth({ user: null, token: "", roles: [] });
        localStorage.removeItem("auth");
        delete axios.defaults.headers.common["Authorization"];
        setRolesLoaded(true);
      } finally {
        // Step 4: mark initialization complete and release the
        // interceptor lock regardless of success or failure.
        initRefreshInFlight.current = false;
        setIsInitialized(true);
      }
    };

    boot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={[auth, setAuth, rolesLoaded, fetchRoles, isInitialized]}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

export { useAuth, AuthProvider };