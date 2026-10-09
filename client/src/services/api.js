import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const TOKEN_KEY = 'autolead_jwt_token';

/**
 * Centralized token access helpers
 */
export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to update localStorage auth token:', err);
  }
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to clear localStorage auth token:', err);
  }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach Bearer JWT token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Standardize responses and handle 401 errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'API request failed';
    const errors = error.response?.data?.errors || null;

    // Handle unauthorized session expiration
    if (status === 401) {
      const url = error.config?.url || '';
      // Don't auto-clear on failed login or register attempts
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        clearAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }
    }

    return Promise.reject({
      status,
      message,
      errors,
      data: error.response?.data,
    });
  }
);

/**
 * Health check endpoint service
 */
export const checkHealth = () => apiClient.get('/health');

export default apiClient;
