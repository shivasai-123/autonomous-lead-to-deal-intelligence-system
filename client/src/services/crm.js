import apiClient from './api';

export const crmService = {
  // Lead APIs
  getLeads: (params = {}) => apiClient.get('/leads', { params }),
  getLead: (id) => apiClient.get(`/leads/${id}`),
  createLead: (data, forceCreate = false) =>
    apiClient.post('/leads', { ...data, forceCreate }),
  updateLead: (id, data) => apiClient.patch(`/leads/${id}`, data),
  archiveLead: (id) => apiClient.delete(`/leads/${id}`),
  checkDuplicates: (data) => apiClient.post('/leads/check-duplicates', data),

  // Company APIs
  getCompanies: (params = {}) => apiClient.get('/companies', { params }),
  getCompany: (id) => apiClient.get(`/companies/${id}`),
  createCompany: (data) => apiClient.post('/companies', data),
  updateCompany: (id, data) => apiClient.patch(`/companies/${id}`, data),

  // Activity APIs
  getLeadActivities: (leadId, params = {}) =>
    apiClient.get(`/leads/${leadId}/activities`, { params }),
  createLeadActivity: (leadId, data) =>
    apiClient.post(`/leads/${leadId}/activities`, data),

  // Assignable users for dropdowns
  getAssignableUsers: () => apiClient.get('/users').catch(() => ({ data: { users: [] } })),
};

export default crmService;
