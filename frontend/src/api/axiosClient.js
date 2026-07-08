// -----------------------------------------------------------------------------
// axiosClient.js — a single configured axios instance used everywhere.
//
// The access token lives only in memory (see AuthContext), never in
// localStorage, to reduce XSS blast radius. When a request comes back 401
// (access token expired), the interceptor silently calls /auth/refresh
// (which reads the httpOnly refresh cookie the browser sends automatically)
// and retries the original request exactly once.
// -----------------------------------------------------------------------------

import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // sends/receives the httpOnly refresh cookie
});

// These are set from AuthContext once it mounts, avoiding a circular import
// between axiosClient and AuthContext.
let accessToken = null;
let onRefreshFailed = () => {};

export function setAccessToken(token) {
  accessToken = token;
}
export function setOnRefreshFailed(callback) {
  onRefreshFailed = callback;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request until the in-flight refresh resolves.
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      isRefreshing = true;
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        pendingRequests.forEach((p) => p.resolve());
        pendingRequests = [];
        return api(originalRequest);
      } catch (refreshError) {
        pendingRequests.forEach((p) => p.reject(refreshError));
        pendingRequests = [];
        onRefreshFailed();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
