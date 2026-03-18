import axios from "axios";
import { useAuthStore } from "../hooks/useAuthStore";

const api = axios.create({
  baseURL: "/api",
  timeout: 30_000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post("/api/auth/refresh", { refresh_token: refreshToken });
          useAuthStore.getState().login(
            data.access_token,
            refreshToken,
            useAuthStore.getState().user!
          );
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
