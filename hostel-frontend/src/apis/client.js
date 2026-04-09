// API Configuration & Client Interceptors for Hostel Frontend
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
}

export function clearAuthToken() {
  delete apiClient.defaults.headers.common["Authorization"];
}

// Response interceptor: try a single refresh attempt on 401 (best-effort)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      // Avoid infinite loop
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Best-effort refresh call. Backend must implement /auth/refresh for this to work.
        const resp = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = resp.data?.token;
        if (newToken) {
          setAuthToken(newToken);
          localStorage.setItem("token", newToken);
          processQueue(null, newToken);
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
