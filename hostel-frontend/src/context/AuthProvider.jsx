import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import apiClient, { setAuthToken, clearAuthToken } from "../apis/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const logoutTimerRef = useRef(null);

  const isAuthenticated = !!user && !!token;

  // Check token from URL on mount (from central login portal redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tokenFromUrl = urlParams.get("token");
    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      setToken(tokenFromUrl);
      setAuthToken(tokenFromUrl);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  const getData = async (tokenToUse) => {
    try {
      setAuthToken(tokenToUse);
      const response = await apiClient.get(`/hostel/get`);
      setUser(response.data.hostel);
    } catch (error) {
      console.error("Error fetching hostel data:", error);
      logout();
    }
  };

  const logout = (reason = null) => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    clearAuthToken();
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    const APP_URL = import.meta.env.VITE_APP_URL || "http://localhost:5172";
    window.location.href = APP_URL;
  };

  // Primary useEffect for initial authentication check
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setAuthToken(storedToken);

      try {
        const decoded = jwtDecode(storedToken);
        const expire = decoded.exp * 1000 - Date.now();

        if (expire < 1000) {
          logout("Session has expired");
          return;
        }

        if (token !== storedToken) {
          setToken(storedToken);
        }

        await getData(storedToken);

        if (logoutTimerRef.current) {
          clearTimeout(logoutTimerRef.current);
        }
        logoutTimerRef.current = setTimeout(() => {
          logout("Session has expired");
        }, expire);
      } catch (error) {
        console.error("Error in initializeAuth:", error);
        logout("Invalid Session");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    } else {
      clearAuthToken();
    }
  }, [token]);

  const authContextValue = {
    user,
    token,
    logout,
    isAuthenticated,
    isLoading,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
