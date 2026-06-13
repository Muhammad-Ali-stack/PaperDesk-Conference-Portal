import { useState, useEffect, useContext, createContext } from "react";
import axios from "axios";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    user: null,
    token: "",
    roles: [],
  });
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // Set axios default header when auth.token changes
  useEffect(() => {
    axios.defaults.headers.common["Authorization"] = auth?.token ? `Bearer ${auth.token}` : "";
  }, [auth.token]);

  const fetchRoles = async (userId, silent = false) => {
    try {
      if (!silent) setRolesLoaded(false);
      const res = await axios.get(`/api/auth/user-roles/${userId}`);
      if (res.status === 200 && res.data.success) {
        // FIXED: Access nested data.roles
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
        // If we have cached roles, we can still fetch fresh ones in background
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