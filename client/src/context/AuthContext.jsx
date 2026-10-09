import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { getAuthToken, setAuthToken, clearAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize session by checking existing token and fetching profile.
   */
  const initSession = useCallback(async () => {
    const existingToken = getAuthToken();
    if (!existingToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await authService.getMe();
      if (response?.data?.user) {
        setUser(response.data.user);
        setTokenState(existingToken);
      } else {
        clearAuthToken();
        setUser(null);
        setTokenState(null);
      }
    } catch {
      clearAuthToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();

    // Listen for unauthorized 401 events dispatched by Axios interceptor
    const handleUnauthorized = () => {
      setUser(null);
      setTokenState(null);
      clearAuthToken();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [initSession]);

  /**
   * Log in user
   */
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authService.login({ email, password });
      const { user: loggedInUser, token: receivedToken } = response.data;
      setAuthToken(receivedToken);
      setTokenState(receivedToken);
      setUser(loggedInUser);
      return { success: true, user: loggedInUser };
    } catch (err) {
      const errorMsg = err.message || 'Login failed. Please check your credentials.';
      setError(errorMsg);
      return { success: false, error: errorMsg, errors: err.errors };
    }
  };

  /**
   * Register a new user
   */
  const register = async (userData) => {
    setError(null);
    try {
      const response = await authService.register(userData);
      const { user: registeredUser, token: receivedToken } = response.data;
      setAuthToken(receivedToken);
      setTokenState(receivedToken);
      setUser(registeredUser);
      return { success: true, user: registeredUser };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed.';
      setError(errorMsg);
      return { success: false, error: errorMsg, errors: err.errors };
    }
  };

  /**
   * Log out current session
   */
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout network errors; local state cleanup is prioritized
    } finally {
      clearAuthToken();
      setTokenState(null);
      setUser(null);
      setError(null);
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshSession: initSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
