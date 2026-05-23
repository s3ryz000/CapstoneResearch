import { apiClient } from './client';

/**
 * Staff dashboard API — for record requests, student lookup, document release, reports.
 * All endpoints require auth:sanctum and staff/admin role on backend.
 */
export const staffApi = {
  getPendingRequests: async (params = {}) => {
    const { data } = await apiClient.get('/staff/pending-requests', { params });
    return data;
  },

  getApprovedRequests: async (params = {}) => {
    const { data } = await apiClient.get('/staff/approved-release', { params });
    return data;
  },

  getRejectedRequests: async (params = {}) => {
    const { data } = await apiClient.get('/staff/rejected-requests', { params });
    return data;
  },

  approveRequest: async (id, payload = {}) => {
    const { data } = await apiClient.patch(`/staff/requests/${id}/approve`, payload);
    return data;
  },

  rejectRequest: async (id, payload = {}) => {
    const { data } = await apiClient.patch(`/staff/requests/${id}/reject`, payload);
    return data;
  },

  getApprovedForRelease: async (params = {}) => {
    const { data } = await apiClient.get('/staff/approved-release', { params });
    return data;
  },

  releaseDocument: async (requestId) => {
    const { data } = await apiClient.post('/staff/transactions', {
      request_id: requestId,
      transaction_type: 'release',
    });
    return data;
  },

  downloadTranscriptTemplate: async (requestId) => {
    const response = await apiClient.get(`/staff/requests/${requestId}/transcript-template`, {
      responseType: 'blob',
    });
    return response;
  },

  getAppointmentSlots: async (params = {}) => {
    const { data } = await apiClient.get('/staff/appointment-slots', { params });
    return data;
  },

  downloadApprovalSlip: async (requestId) => {
    const response = await apiClient.get(`/staff/requests/${requestId}/approval-slip`, {
      responseType: 'blob',
    });
    return response;
  },

  getStudents: async (params = {}) => {
    const { data } = await apiClient.get('/staff/students', { params });
    return data;
  },

  /** Program list for staff filters (course dropdown). Cached client-side via React Query. */
  getPrograms: async () => {
    const { data } = await apiClient.get('/staff/programs');
    return data;
  },

  getProgramCurriculum: async (programId) => {
    const { data } = await apiClient.get(`/staff/programs/${programId}/curriculum`);
    return data;
  },

  getStudentById: async (id) => {
    const { data } = await apiClient.get(`/staff/students/${id}`);
    return data;
  },

  /** Official transcript XLSX for a student (staff/admin). */
  downloadStudentTranscript: async (studentId) => {
    const response = await apiClient.get(`/staff/students/${studentId}/transcript`, {
      responseType: 'blob',
    });
    return response;
  },

  getReportsSummary: async () => {
    const { data } = await apiClient.get('/staff/reports/summary');
    return data;
  },

  getTransactionHistory: async (params = {}) => {
    const { data } = await apiClient.get('/staff/reports/transaction-history', { params });
    return data;
  },

  /**
   * Create a new student (staff/admin only).
   * Payload: student_number, first_name, last_name, date_of_birth, email,
   * contact_number?, address?, enrollment_date, graduation_date?, GPA?
   */
  createStudent: async (payload) => {
    const { data } = await apiClient.post('/staff/students', payload);
    return data;
  },

  /**
   * Update an existing student (staff/admin only).
   */
  updateStudent: async (id, payload) => {
    const { data } = await apiClient.put(`/staff/students/${id}`, payload);
    return data;
  },

  /** Change student's active program. Requires: new_program_id, reason. Optional: remarks. */
  updateStudentProgram: async (studentId, payload) => {
    const { data } = await apiClient.patch(`/staff/students/${studentId}/program`, payload);
    return data;
  },

  /** Fetch curriculum subjects for a program filtered by year_level and semester */
  getProgramCurriculumFiltered: async (programId, yearLevel, semester) => {
    const { data } = await apiClient.get(`/staff/programs/${programId}/curriculum`, {
      params: { year_level: yearLevel, semester },
    });
    return data;
  },

  /** List subjects for dropdowns (staff/admin). Per thesis: subject code, title, units. */
  getSubjects: async () => {
    const { data } = await apiClient.get('/staff/subjects');
    return data;
  },

  /** Add enrollment. Required: subject_id, academic_year, semester. Optional: status. */
  createEnrollment: async (studentId, payload) => {
    const { data } = await apiClient.post(`/staff/students/${studentId}/enrollments`, payload);
    return data;
  },

  updateEnrollment: async (studentId, enrollmentId, payload) => {
    const { data } = await apiClient.put(`/staff/students/${studentId}/enrollments/${enrollmentId}`, payload);
    return data;
  },

  deleteEnrollment: async (studentId, enrollmentId, payload = {}) => {
    // DELETE with body — axios supports this via `data` config key
    const { data } = await apiClient.delete(`/staff/students/${studentId}/enrollments/${enrollmentId}`, {
      data: payload,
    });
    return data;
  },

  /** Add grade. Required: subject_id, academic_year, semester. Optional: grade_value, remarks. */
  createGrade: async (studentId, payload) => {
    const { data } = await apiClient.post(`/staff/students/${studentId}/grades`, payload);
    return data;
  },

  updateGrade: async (studentId, gradeId, payload) => {
    const { data } = await apiClient.put(`/staff/students/${studentId}/grades/${gradeId}`, payload);
    return data;
  },

  deleteGrade: async (studentId, gradeId) => {
    const { data } = await apiClient.delete(`/staff/students/${studentId}/grades/${gradeId}`);
    return data;
  },

  archiveStudent: async (studentId, payload) => {
    const { data } = await apiClient.post(`/staff/students/${studentId}/archive`, payload);
    return data;
  },

  // ── Academic Progression endpoints ──

  /** Get full academic progress for a student (staff/admin). */
  getAcademicProgress: async (studentId) => {
    const { data } = await apiClient.get(`/staff/students/${studentId}/academic-progress`);
    return data;
  },

  getAcademicSummary: async (studentId) => {
    const { data } = await apiClient.get(`/staff/students/${studentId}/academic-summary`);
    return data.summary;
  },

  /** Add enrollment for the next allowed term. Backend computes term. */
  addNextTerm: async (studentId, payload) => {
    const { data } = await apiClient.post(`/staff/students/${studentId}/enrollments/add-next-term`, payload);
    return data;
  },

  /** Bulk update grades for enrolled subjects. */
  bulkUpdateGrades: async (studentId, payload) => {
    const { data } = await apiClient.put(`/staff/students/${studentId}/grades/bulk-update`, payload);
    return data;
  },
};
