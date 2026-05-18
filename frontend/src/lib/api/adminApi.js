import { apiClient } from './client';

/**
 * Admin API — users, system settings, reports export.
 * All endpoints require auth:sanctum and role:admin.
 */
export const adminApi = {
  // ---- Users ----
  getUsers: async (params = {}) => {
    const { data } = await apiClient.get('/admin/users', { params });
    return data;
  },

  getUser: async (id) => {
    const { data } = await apiClient.get(`/admin/users/${id}`);
    return data;
  },

  createUser: async (payload) => {
    const { data } = await apiClient.post('/admin/users', payload);
    return data;
  },

  updateUser: async (id, payload) => {
    const { data } = await apiClient.put(`/admin/users/${id}`, payload);
    return data;
  },

  deleteUser: async (id) => {
    const { data } = await apiClient.delete(`/admin/users/${id}`);
    return data;
  },

  // ---- System settings ----
  getSettings: async () => {
    const { data } = await apiClient.get('/admin/settings');
    return data;
  },

  updateSettings: async (payload) => {
    const { data } = await apiClient.put('/admin/settings', payload);
    return data;
  },

  // ---- Reports export ----
  exportReports: async (params = {}) => {
    const { data } = await apiClient.get('/admin/reports/export', { params });
    return data;
  },

  // ---- System logs ----
  getSystemLogs: async (params = {}) => {
    const { data } = await apiClient.get('/admin/logs', { params });
    return data;
  },

  exportSystemLogsPdf: async () => {
    const { data } = await apiClient.get('/admin/logs/export-pdf', { responseType: 'blob' });
    return data;
  },
};
