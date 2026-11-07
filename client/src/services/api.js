// ==============================================================================
// ExamSphere – Axios Client Configuration & Interceptors
// Configured with credentials support for HttpOnly cookies and centralized single-flight token refresh
// ==============================================================================

import axios from 'axios';
import { decodeToken, isTokenExpired } from '../lib/utils.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 35000,
});

// URLs that should never trigger token refresh or auth loops
const AUTH_EXCLUDED_URLS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isAuthExcluded = (url) => {
  if (!url) return false;
  return AUTH_EXCLUDED_URLS.some((pattern) => url.includes(pattern));
};

// Endpoints that do not require an authentication token
const PUBLIC_URL_PATTERNS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/health',
];

const isPublicUrl = (url) => {
  if (!url) return false;
  return PUBLIC_URL_PATTERNS.some((pattern) => url.includes(pattern));
};

// Response interceptor with single-flight automatic refresh retry
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

export const clearSessionAndExpire = () => {
  localStorage.removeItem('examsphere_token');
  localStorage.removeItem('examsphere_refresh_token');
  localStorage.removeItem('examsphere_user');
  delete api.defaults.headers.common.Authorization;
  window.dispatchEvent(new Event('auth:expired'));
};

// Request interceptor to attach JWT token and validate expiration before sending
api.interceptors.request.use(
  async (config) => {
    if (isPublicUrl(config.url)) {
      return config;
    }

    const token = localStorage.getItem('examsphere_token');
    if (!token) {
      // Prevent unauthenticated HTTP requests to protected backend endpoints
      return Promise.reject({
        message: 'Authentication token is missing. Please log in.',
        statusCode: 401,
        isTokenMissing: true,
      });
    }

    const decoded = decodeToken(token);
    if (decoded && isTokenExpired(decoded)) {
      const storedRefreshToken = localStorage.getItem('examsphere_refresh_token');
      if (!storedRefreshToken) {
        clearSessionAndExpire();
        return Promise.reject({
          message: 'Session expired. Please log in again.',
          statusCode: 401,
        });
      }

      // If refresh is already in-flight, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${newToken}`;
          return config;
        });
      }

      isRefreshing = true;
      try {
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.data?.accessToken;
        const newRefreshToken = refreshResponse.data?.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('examsphere_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('examsphere_refresh_token', newRefreshToken);
          }
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return config;
        } else {
          throw new Error('Refresh endpoint returned no token');
        }
      } catch (err) {
        processQueue(err, null);
        clearSessionAndExpire();
        return Promise.reject({
          message: 'Session expired. Please log in again.',
          statusCode: 401,
        });
      } finally {
        isRefreshing = false;
      }
    }

    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // Preserve standard Axios/AbortController cancellation identity
    if (
      axios.isCancel(error) ||
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError' ||
      error?.message === 'canceled'
    ) {
      const canceledErr = new Error('canceled');
      canceledErr.name = 'CanceledError';
      canceledErr.code = 'ERR_CANCELED';
      canceledErr.isCanceled = true;
      return Promise.reject(canceledErr);
    }

    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject({
        name: error.name || 'Error',
        code: error.code || null,
        message: error.message || 'Network error occurred',
        statusCode: error.response?.status || 500,
      });
    }

    // If 401 on an already-retried request, clear session immediately and avoid infinite loop
    if (error.response?.status === 401 && originalRequest._retry) {
      clearSessionAndExpire();
      return Promise.reject({
        message: 'Session expired. Please log in again.',
        statusCode: 401,
      });
    }

    // If 401 Unauthorized, not already retrying, and not an auth management endpoint
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthExcluded(originalRequest.url)) {
      const storedRefreshToken = localStorage.getItem('examsphere_refresh_token');

      // If no refresh token exists, clear session immediately and redirect
      if (!storedRefreshToken) {
        clearSessionAndExpire();
        return Promise.reject({
          message: 'Session expired. Please log in again.',
          statusCode: 401,
        });
      }

      // If a refresh is already in-flight, queue this request (single-flight)
      if (isRefreshing) {
        originalRequest._retry = true;
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.data?.accessToken;
        const newRefreshToken = refreshResponse.data?.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('examsphere_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('examsphere_refresh_token', newRefreshToken);
          }
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error('No access token returned by refresh endpoint');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearSessionAndExpire();
        return Promise.reject({
          message: 'Session expired. Please log in again.',
          statusCode: 401,
        });
      } finally {
        isRefreshing = false;
      }
    }

    const formattedError = {
      name: error.name || 'Error',
      code: error.code || null,
      message: error.response?.data?.message || error.message || 'Network request failed',
      statusCode: error.response?.status || 500,
      errors: error.response?.data?.errors || [],
    };
    return Promise.reject(formattedError);
  }
);

export default api;

