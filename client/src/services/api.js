import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const wsId = localStorage.getItem('workspaceId');
  if (wsId) config.headers['x-workspace-id'] = wsId;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (response?.status === 402) {
      const msg = response.data?.message || 'Subscription expired';
      toast.error(msg, { duration: 6000 });
      if (response.data?.suspended || response.data?.planExpired) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => { window.location.href = '/login'; }, 3000);
      }
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// ─── SUPER ADMIN ──────────────────────────────────────────────────────────
export const superAdminAPI = {
  getDashboard: () => api.get('/superadmin/dashboard'),
  getOrganizations: (params) => api.get('/superadmin/organizations', { params }),
  getOrganization: (id) => api.get(`/superadmin/organizations/${id}`),
  createOrganization: (data) => api.post('/superadmin/organizations', data),
  updateOrganization: (id, data) => api.put(`/superadmin/organizations/${id}`, data),
  suspendOrganization: (id, data) => api.post(`/superadmin/organizations/${id}/suspend`, data),
  unsuspendOrganization: (id) => api.post(`/superadmin/organizations/${id}/unsuspend`),
  deleteOrganization: (id) => api.delete(`/superadmin/organizations/${id}`),
  getPlans: () => api.get('/superadmin/plans'),
  updatePlan: (id, data) => api.put(`/superadmin/plans/${id}`, data),
};

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────
export const orgAPI = {
  getDashboard: (params) => api.get('/organizations/dashboard', { params }),
  getWorkspaces: () => api.get('/organizations/workspaces'),
  createWorkspace: (data) => api.post('/organizations/workspaces', data),
  getWorkspace: (id) => api.get(`/organizations/workspaces/${id}`),
  updateWorkspace: (id, data) => api.put(`/organizations/workspaces/${id}`, data),
  deleteWorkspace: (id) => api.delete(`/organizations/workspaces/${id}`),
  getReports: (params) => api.get('/organizations/reports', { params }),
  getSettings: () => api.get('/organizations/settings'),
  updateSettings: (data) => api.put('/organizations/settings', data),
  getWebhookWorkspaces: () => api.get('/organizations/webhook-workspaces'),
  getWebhookRoutes: () => api.get('/organizations/webhook-routes'),
  createWebhookRoute: (data) => api.post('/organizations/webhook-routes', data),
  updateWebhookRoute: (id, data) => api.put(`/organizations/webhook-routes/${id}`, data),
  deleteWebhookRoute: (id) => api.delete(`/organizations/webhook-routes/${id}`),
  removeUserFromWorkspace: (workspaceId, userId) => api.delete(`/organizations/workspaces/${workspaceId}/users/${userId}`),
};

// ─── WORKSPACE ────────────────────────────────────────────────────────────
export const workspaceAPI = {
  get: () => api.get('/workspace'),
  update: (data) => api.put('/workspace', data),
};

// ─── LEADS ────────────────────────────────────────────────────────────────
export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  get: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  getPipeline: () => api.get('/leads/pipeline'),
  addNote: (id, note) => api.post(`/leads/${id}/note`, { note }),
  bulkAssign: (leadIds, assignedTo) => api.put('/leads/bulk-assign', { leadIds, assignedTo }),
  bulkAssignWorkspace: (leadIds, workspaceId) => api.put('/leads/bulk-assign-workspace', { leadIds, workspaceId }),
  bulkDelete: (leadIds) => api.delete('/leads/bulk-delete', { data: { leadIds } }),
  importCSV: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
};

// ─── FOLLOWUPS ────────────────────────────────────────────────────────────
export const followupsAPI = {
  getAll: (params) => api.get('/followups', { params }),
  getOverdueCount: () => api.get('/followups/overdue-count'),
  create: (data) => api.post('/followups', data),
  update: (id, data) => api.put(`/followups/${id}`, data),
  complete: (id, data) => api.post(`/followups/${id}/complete`, data),
  cancel: (id) => api.post(`/followups/${id}/cancel`),
};

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getCalendar: (params) => api.get('/appointments/calendar', { params }),
  getToday: () => api.get('/appointments/today'),
  getUpcoming: () => api.get('/appointments/upcoming'),
  get: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  updateStatus: (id, data) => api.put(`/appointments/${id}/status`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
};

// ─── QUOTATIONS ───────────────────────────────────────────────────────────
export const quotationsAPI = {
  getAll: (params) => api.get('/quotations', { params }),
  get: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  updateStatus: (id, data) => api.put(`/quotations/${id}/status`, data),
  downloadPDF: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/quotations/${id}/send-email`),
  whatsappShare: (id) => api.post(`/quotations/${id}/whatsapp-share`),
  delete: (id) => api.delete(`/quotations/${id}`),
};

// ─── INVOICES ─────────────────────────────────────────────────────────────
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  downloadPDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/invoices/${id}/send-email`),
  whatsappShare: (id) => api.post(`/invoices/${id}/whatsapp-share`),
  delete: (id) => api.delete(`/invoices/${id}`),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getStats: (params) => api.get('/payments/stats', { params }),
  add: (data) => api.post('/payments', data),
};

// ─── CONTENT ──────────────────────────────────────────────────────────────
export const contentAPI = {
  getAll: (params) => api.get('/content', { params }),
  getCalendar: (params) => api.get('/content/calendar', { params }),
  getPipeline: () => api.get('/content/pipeline'),
  getArchived: (params) => api.get('/content/archived', { params }),
  get: (id) => api.get(`/content/${id}`),
  create: (data) => api.post('/content', data),
  update: (id, data) => api.put(`/content/${id}`, data),
  delete: (id) => api.delete(`/content/${id}`),
  archive: (id) => api.post(`/content/${id}/archive`),
  unarchive: (id) => api.post(`/content/${id}/unarchive`),
  archiveBulk: () => api.post('/content/archive-bulk'),
};

// ─── REPORTS ──────────────────────────────────────────────────────────────
export const reportsAPI = {
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  getLoginSummary: () => api.get('/reports/login-summary'),
  getAdvanced: (params) => api.get('/reports/advanced', { params }),
};

// ─── TEAM ACTIVITY ────────────────────────────────────────────────────────
export const teamActivityAPI = {
  getSummary: () => api.get('/team-activity/summary'),
  getFeed: (params) => api.get('/team-activity/feed', { params }),
  getEmployeeStats: (userId) => api.get(`/team-activity/employee-stats/${userId}`),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getCount: () => api.get('/notifications/count'),
  getRecent: () => api.get('/notifications/recent'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
};

// ─── USERS ────────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// ─── EMPLOYEE LABELS ──────────────────────────────────────────────────────
export const employeeLabelsAPI = {
  getAll: () => api.get('/employee-labels'),
  create: (data) => api.post('/employee-labels', data),
  delete: (id) => api.delete(`/employee-labels/${id}`),
};

// ─── META INTEGRATIONS ────────────────────────────────────────────────────
export const metaIntegrationAPI = {
  getAll: () => api.get('/meta-integrations'),
  connect: (data) => api.post('/meta-integrations', data),
  update: (id, data) => api.put(`/meta-integrations/${id}`, data),
  disconnect: (id) => api.delete(`/meta-integrations/${id}`),
  sync: (id) => api.post(`/meta-integrations/${id}/sync`),
  getForms: (id) => api.get(`/meta-integrations/${id}/forms`),
  updateFormRoutes: (id, formRoutes) => api.put(`/meta-integrations/${id}/form-routes`, { formRoutes }),
  testConnection: (id) => api.get(`/meta-integrations/${id}/test`),
};

// ─── COMMUNICATION ────────────────────────────────────────────────────────
export const communicationAPI = {
  logCall: (data) => api.post('/communication/calls', data),
  getCalls: (params) => api.get('/communication/calls', { params }),
  logWhatsApp: (data) => api.post('/communication/whatsapp', data),
  sendEmail: (data) => api.post('/communication/email', data),
};

export default api;
