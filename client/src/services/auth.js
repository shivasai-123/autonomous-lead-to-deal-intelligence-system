import apiClient from './api';

export const authService = {
  /**
   * Log in user with email and password
   */
  login: (credentials) => apiClient.post('/auth/login', credentials),

  /**
   * Register a new sales representative account
   */
  register: (userData) => apiClient.post('/auth/register', userData),

  /**
   * Fetch current authenticated user profile
   */
  getMe: () => apiClient.get('/auth/me'),

  /**
   * Log out current session
   */
  logout: () => apiClient.post('/auth/logout'),

  /**
   * List users (Admin and Sales Manager only)
   */
  listUsers: (params) => apiClient.get('/users', { params }),

  /**
   * Update user status (Admin only)
   */
  updateUserStatus: (id, isActive) => apiClient.patch(`/users/${id}/status`, { isActive }),

  /**
   * Update user role (Admin only)
   */
  updateUserRole: (id, roleName) => apiClient.patch(`/users/${id}/role`, { roleName }),
};

export default authService;
