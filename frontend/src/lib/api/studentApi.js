import { apiClient } from './client';

/**
 * All endpoints require auth:sanctum and role:student.
 */
export const studentApi = {
  /** Get authenticated student's profile (student + program + academic year/semester). */
  getProfile: async () => {
    const { data } = await apiClient.get('/student/profile');
    return data;
  },

  /** Update authenticated student's SIS/SIUF fields (own record only). */
  updateSIS: async (payload) => {
    const { data } = await apiClient.put('/student/sis', payload);
    return data;
  },

  getSubjects: async (params = {}) => {
    const { data } = await apiClient.get('/student/subjects', { params });
    return data;
  },

  /** Grades. Params: academic_year?, semester? */
  getGrades: async (params = {}) => {
    const { data } = await apiClient.get('/student/grades', { params });
    return data;
  },

  /** List authenticated student's record requests (paginated). */
  getRecordRequests: async (params = {}) => {
    const { data } = await apiClient.get('/student/record-requests', { params });
    return data;
  },

  /** Submit a new record request. Payload: { record_type, purpose?, copies? } */
  createRecordRequest: async (payload) => {
    const { data } = await apiClient.post('/student/record-requests', payload);
    return data;
  },

  /** Get a single record request by id (own only). */
  getRecordRequest: async (id) => {
    const { data } = await apiClient.get(`/student/record-requests/${id}`);
    return data;
  },

  downloadApprovalSlip: async (id) => {
    const response = await apiClient.get(`/student/record-requests/${id}/approval-slip`, {
      responseType: 'blob',
    });
    return response;
  },

  downloadTranscript: async (id) => {
    const response = await apiClient.get(`/student/record-requests/${id}/transcript`, {
      responseType: 'blob',
    });
    return response;
  },
};
