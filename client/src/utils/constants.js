export const APP_NAME = 'Autonomous Lead-to-Deal Intelligence System';
export const APP_SHORT_NAME = 'AutoLead CRM';
export const APP_VERSION = '1.0.0 (Phase 1)';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LEADS: '/leads',
  PIPELINE: '/pipeline',
  COMPANIES: '/companies',
  SETTINGS: '/settings'
};
