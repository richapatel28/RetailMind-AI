import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 60000, // 60s for AI operations like audio transcription and Gemini Vision
});

// Request interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("retailmind_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Global error formatting & auth redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Avoid redirecting if already on login
      if (!window.location.pathname.includes("/login")) {
        localStorage.removeItem("retailmind_token");
        localStorage.removeItem("retailmind_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
