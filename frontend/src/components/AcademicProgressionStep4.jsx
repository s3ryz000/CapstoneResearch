import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiSave, FiAlertCircle, FiTrash2, FiClock, FiAward, FiCheckCircle, FiAlertTriangle, FiXCircle, FiInfo } from 'react-icons/fi';

import { staffApi } from '../lib/api/staffApi';
import { staffToast } from '../lib/notifications';
import { queryKeys } from '../lib/react-query/queryKeys';

export default function AcademicProgressionStep4({
  studentId,
  studentProgram,
  programs,
  handleProgramDropdownChange,
  programChangeLoading,
  inputBase,
  inputNormal,
  inputError,
}) {
  const queryClient = useQueryClient();

  // Fetch Academic Progress
  const { data: progress, isLoading, error } = useQuery({
    queryKey: ['academicProgress', studentId],
    queryFn: () => staffApi.getAcademicProgress(studentId),
    enabled: !!studentId,
  });

  const { data: summary } = useQuery({
    queryKey: ['academicSummary', studentId],
    queryFn: () => staffApi.getAcademicSummary(studentId),
    enabled: !!studentId,
  });

  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [editingGrades, setEditingGrades] = useState({}); // { gradeId: { grade_value, status, remarks, supporting_document_reference } }

  useEffect(() => {
    // Clear drafts when student changes to prevent state leaks
    setSelectedSubjects([]);
    setEditingGrades({});
  }, [studentId]);

  const addNextTermMutation = useMutation({
    mutationFn: (payload) => staffApi.addNextTerm(studentId, payload),
    onSuccess: () => {
      staffToast.success('Enrollments added successfully.');
      queryClient.invalidateQueries({ queryKey: ['academicProgress', studentId] });
      queryClient.invalidateQueries({ queryKey: ['academicSummary', studentId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.student(studentId) });
      setSelectedSubjects([]);
    },
    onError: () => {
      // Enrollment errors are surfaced inline by the backend validation response;
      // suppress the generic toast to avoid duplicate / confusing pop-ups.
    },
  });

  const bulkUpdateGradesMutation = useMutation({
    mutationFn: (payload) => staffApi.bulkUpdateGrades(studentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academicProgress', studentId] });
      queryClient.invalidateQueries({ queryKey: ['academicSummary', studentId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.student(studentId) });
      setEditingGrades({});
    },
    onError: () => {
      // Silent failure — no toast shown
    },
  });

  const cancelEnrollmentMutation = useMutation({
    mutationFn: ({ enrollmentId, reason }) => staffApi.deleteEnrollment(studentId, enrollmentId, reason),
    onSuccess: () => {
      staffToast.success('Enrollment cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['academicProgress', studentId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.student(studentId) });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to cancel enrollment.';
      staffToast.error(msg);
    },
  });


  const handleAddNextTerm = (e) => {
    e.preventDefault();
    if (selectedSubjects.length === 0) {
      staffToast.error('Please select at least one subject to enroll.');
      return;
    }
    addNextTermMutation.mutate({ subject_ids: selectedSubjects });
  };

  const handleGradeChange = (gradeId, field, value) => {
    setEditingGrades((prev) => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        [field]: value,
      },
    }));
  };

  const handleGradeSelect = (gradeId, gradeValue) => {
    let status = 'Enrolled';
    let remarks = '';

    if (gradeValue) {
      const numGrade = parseFloat(gradeValue);
      if (numGrade >= 1.0 && numGrade <= 3.0) {
        status = 'Passed';
        remarks = 'Passed';
      } else if (numGrade === 4.0) {
        status = 'INC';
        remarks = 'Incomplete';
      } else if (numGrade === 5.0) {
        status = 'Failed';
        remarks = 'Failed';
      }
    }

    setEditingGrades((prev) => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        grade_value: gradeValue,
        status: status,
        remarks: remarks,
      },
    }));
  };

  const handleStatusSelect = (gradeId, statusValue, currentGrade) => {
    let remarks = '';

    if (statusValue === 'Failed' && currentGrade === '5.00') remarks = 'Failed';
    else if (statusValue === 'FDA' && currentGrade === '5.00') remarks = 'FDA';
    else if (statusValue === 'Credited') remarks = 'Credited';
    else if (statusValue === 'Withdrawn') remarks = 'Withdrawn';
    else if (statusValue === 'INC' && currentGrade === '4.00') remarks = 'Incomplete';
    else if (statusValue === 'INC') remarks = 'Incomplete';

    setEditingGrades((prev) => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        status: statusValue,
        remarks: remarks || prev[gradeId]?.remarks || '',
      },
    }));
  };

  const handleSaveGrades = (termGroup) => {
    const gradesToUpdate = [];
    termGroup.subjects.forEach((subj) => {
      if (subj.grade_id && editingGrades[subj.grade_id]) {
        const payload = {
          grade_id: subj.grade_id,
          ...editingGrades[subj.grade_id],
        };
        if (payload.grade_value === '') {
          payload.grade_value = null;
        }
        gradesToUpdate.push(payload);
      }
    });

    if (gradesToUpdate.length === 0) {
      staffToast.info('No changes to save.');
      return;
    }

    bulkUpdateGradesMutation.mutate({ grades: gradesToUpdate });
  };



  const handleCancelEnrollment = (enrollment) => {
    // If it has a final grade, warn them (backend will block anyway, but good for UX)
    const finalStatuses = ['Passed', 'Failed', 'INC', 'Withdrawn', 'FDA', 'Credited'];
    if (enrollment.grade_status && finalStatuses.includes(enrollment.grade_status)) {
      staffToast.error('This enrollment already has a final status. Use the correction workflow instead.');
      return;
    }

    const reason = window.prompt('Please provide a reason for cancelling this enrollment:');
    if (reason === null) return; // User cancelled prompt
    if (!reason.trim()) {
      staffToast.error('A reason is required to cancel an enrollment.');
      return;
    }

    cancelEnrollmentMutation.mutate({ enrollmentId: enrollment.enrollment_id, reason });
  };


  const toggleSubject = (subjectId, isRequired) => {
    if (isRequired) return; // Cannot toggle required subjects
    setSelectedSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  // Auto-select eligible subjects when available subjects load
  React.useEffect(() => {
    if (progress?.available_subjects) {
      const eligibleIds = progress.available_subjects.filter(s => s.eligible).map(s => s.subject_id);
      setSelectedSubjects(eligibleIds);
    }
  }, [progress?.available_subjects]);

  // ── Academic load constants ──────────────────────────────────────────────
  const LOAD_MIN = 18;
  const LOAD_MAX = 26;

  // Sum units for the currently selected subjects (live, derived from checked boxes).
  // Must be a useMemo (not inline) so it stays above conditional returns.
  const selectedUnits = React.useMemo(() => {
    if (!progress?.available_subjects || selectedSubjects.length === 0) return 0;
    return progress.available_subjects
      .filter(s => selectedSubjects.includes(s.subject_id))
      .reduce((sum, s) => sum + (Number(s.units) || 0), 0);
  }, [selectedSubjects, progress?.available_subjects]);

  // Total units the student could enroll in (eligible subjects only).
  // Comes from the backend so it reflects actual curriculum + prerequisite state.
  const maxEligibleUnits = progress?.max_eligible_units ?? 0;

  // Derived load status — mirrors backend AcademicLoadValidationService logic.
  const loadStatus = React.useMemo(() => {
    if (selectedSubjects.length === 0)    return 'empty';
    if (selectedUnits > LOAD_MAX)         return 'above_maximum';
    if (selectedUnits >= LOAD_MIN)        return 'valid';
    if (maxEligibleUnits < LOAD_MIN)      return 'valid_underload_exception';
    return 'below_minimum';
  }, [selectedUnits, maxEligibleUnits, selectedSubjects.length]);

  const isLoadValid = loadStatus === 'valid' || loadStatus === 'valid_underload_exception';
  // ────────────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading academic progress...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load academic progress.</div>;
  if (!progress) return null;

  const { next_allowed_term, grouped_enrollments, available_subjects, retake_subjects } = progress;

  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="mb-8 space-y-8">
      {/* ── Student Program Card ── */}
      <div className="p-6 bg-white rounded-xl border-l-4 border-blue-500 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
        <h4 className="m-0 mb-4 text-base font-semibold text-gray-800">Student Program</h4>
        
        {studentProgram?.id ? (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="m-0 text-xs text-blue-600 font-medium uppercase tracking-wide">Current Active Program</p>
            <p className="m-0 mt-1 text-base font-bold text-blue-900">
              {studentProgram.code ? `${studentProgram.code} – ${studentProgram.name}` : `Program ID: ${studentProgram.id}`}
            </p>
          </div>
        ) : (
          <p className="mt-0 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 m-0">
            ⚠ No active program set. Please update the student's program information.
          </p>
        )}
      </div>

      {/* ── Academic Record / Grades (Grouped by Term) ── */}
      <div className="p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
        <h4 className="m-0 mb-6 text-base font-semibold text-gray-800">Academic Record & Grades</h4>

        {grouped_enrollments.length === 0 ? (
          <p className="text-gray-500 text-sm">No enrollments recorded yet.</p>
        ) : (
          <div className="space-y-8">
            {grouped_enrollments.map((group, idx) => {
              const termSummary = summary?.terms?.find(
                (t) => t.academic_year === group.academic_year && String(t.semester) === String(group.semester)
              );

              return (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h5 className="m-0 text-sm font-semibold text-gray-800">
                        {group.year_level ? ordinal(group.year_level) : '?'} Year, {Number(group.semester) === 1 ? '1st' : '2nd'} Semester, A.Y. {group.academic_year}
                      </h5>
                    </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveGrades(group)}
                      disabled={bulkUpdateGradesMutation.isLoading || !Object.keys(editingGrades).some(id => group.subjects.some(s => String(s.grade_id) === String(id)))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded shadow transition-colors ${
                        Object.keys(editingGrades).some(id => group.subjects.some(s => String(s.grade_id) === String(id)))
                          ? 'bg-tmcc text-white hover:bg-tmcc-dark'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <FiSave /> Save Grades
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="text-left font-medium py-2 px-4 w-[120px]">Code</th>
                        <th className="text-left font-medium py-2 px-4 w-[250px]">Subject Title</th>
                        <th className="text-center font-medium py-2 px-4 w-[80px]">Units</th>
                        <th className="text-left font-medium py-2 px-4 w-[140px]">Grade</th>
                        <th className="text-left font-medium py-2 px-4 w-[160px]">Status</th>
                        <th className="text-left font-medium py-2 px-4 min-w-[200px]">Remarks</th>
                        <th className="text-right font-medium py-2 px-4 w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.subjects.map((subj) => {
                        const editState = subj.grade_id ? editingGrades[subj.grade_id] : null;
                        const currentGrade = editState?.grade_value ?? subj.grade_value ?? '';
                        const currentStatus = editState?.status ?? subj.grade_status ?? 'Enrolled';
                        const currentRemarks = editState?.remarks ?? subj.remarks ?? '';

                        let availableStatuses = ['Enrolled', 'Passed', 'Failed', 'INC', 'Withdrawn', 'FDA', 'Credited'];
                        if (currentGrade === '5.00') {
                          availableStatuses = ['Failed', 'FDA'];
                        } else if (['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00'].includes(currentGrade)) {
                          availableStatuses = ['Passed'];
                        } else if (currentGrade === '4.00') {
                          availableStatuses = ['INC'];
                        } else {
                          availableStatuses = ['Enrolled', 'Withdrawn', 'Credited'];
                        }

                        return (
                          <tr key={subj.enrollment_id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-medium text-gray-900">{subj.subject_code}</td>
                            <td className="py-2.5 px-4 text-gray-600">{subj.subject_title}</td>
                            <td className="py-2.5 px-4 text-center text-gray-600">{subj.units}</td>
                            <td className="py-2.5 px-4">
                              <select
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-tmcc focus:border-tmcc"
                                value={currentGrade}
                                onChange={(e) => handleGradeSelect(subj.grade_id, e.target.value)}
                              >
                                {['', '1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '4.00', '5.00'].map(opt => (
                                  <option key={opt} value={opt}>{opt || '—'}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-4">
                              <select
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-tmcc focus:border-tmcc bg-white"
                                value={currentStatus}
                                onChange={(e) => handleStatusSelect(subj.grade_id, e.target.value, currentGrade)}
                              >
                                {availableStatuses.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-tmcc focus:border-tmcc"
                                placeholder="—"
                                value={currentRemarks}
                                onChange={(e) => handleGradeChange(subj.grade_id, 'remarks', e.target.value)}
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => handleCancelEnrollment(subj)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Cancel Enrollment"
                              >
                                <FiTrash2 />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {termSummary && (
                  <div className="bg-gray-50/80 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">Calculated Semestral GWA:</span>
                        <span className="text-lg font-bold text-tmcc">{termSummary.gpa != null ? termSummary.gpa.toFixed(2) : '—'}</span>
                      </div>
                      {!termSummary.deans_list?.eligible && termSummary.gpa != null && (
                         <span className="text-xs text-gray-500">{termSummary.deans_list?.reason}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {termSummary.deans_list?.eligible && (
                        <div className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-sm font-semibold flex items-center gap-1.5 shadow-sm">
                          <FiAward /> Dean's List Awardee
                        </div>
                      )}
                      {Number(group.semester) === 2 && summary?.years?.find(y => y.academic_year === group.academic_year)?.presidents_list?.eligible && (
                        <div className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-sm font-semibold flex items-center gap-1.5 shadow-sm">
                          <FiAward /> President's List Awardee
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )})}
          </div>
        )}
      </div>

      {/* ── Subjects Requiring Retake ── */}
      {retake_subjects && retake_subjects.length > 0 && (
        <div className="p-6 bg-red-50 rounded-xl border-l-4 border-red-500 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-red-100">
          <div className="flex items-center gap-2 mb-4">
            <FiAlertCircle className="text-red-600 text-lg" />
            <h4 className="m-0 text-base font-semibold text-red-900">Subjects Requiring Retake</h4>
          </div>
          <p className="text-sm text-red-700 mb-4">The following subjects were previously failed or withdrawn and must be retaken.</p>
          <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50/50 text-red-800 border-b border-red-100">
                <tr>
                  <th className="text-left font-medium py-2 px-4">Code</th>
                  <th className="text-left font-medium py-2 px-4">Subject Title</th>
                  <th className="text-left font-medium py-2 px-4">Previous Term</th>
                  <th className="text-left font-medium py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                  {retake_subjects.map((subj, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4 font-medium">{subj.subject_code}</td>
                    <td className="py-2 px-4">{subj.subject_title}</td>
                    <td className="py-2 px-4">
                      {subj.previous_academic_year && subj.previous_semester
                        ? `A.Y. ${subj.previous_academic_year}, Sem ${subj.previous_semester}`
                        : 'Unknown previous term'}
                    </td>
                    <td className="py-2 px-4 font-semibold text-red-600">
                      {subj.latest_status || 'Unknown status'}
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Next Semester ── */}
      <div className={`p-6 bg-white rounded-xl border-l-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 ${next_allowed_term.ineligible_max_residency ? 'border-red-500' : 'border-green-500'}`}>
        <h4 className="m-0 mb-4 text-base font-semibold text-gray-800">Add Next Term Enrollments</h4>

        {!next_allowed_term.can_add ? (
          next_allowed_term.program_completed ? (
            /* ── GREEN: Truly completed — all curriculum subjects passed ── */
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-green-800 flex items-start gap-3">
              <div className="mt-0.5 text-green-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold m-0 text-base mb-1">Student is ready to graduate</p>
                <p className="m-0 mt-1 text-sm">{next_allowed_term.blocking_reason}</p>

                {summary && (
                  <div className="mt-4 pt-4 border-t border-green-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                        <p className="text-xs text-green-700 uppercase font-bold tracking-wide mb-1">Final Overall GWA</p>
                        <p className="text-2xl font-black text-green-900 m-0">{summary.overall_gwa != null ? summary.overall_gwa.toFixed(2) : '—'}</p>
                     </div>
                     <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                        <p className="text-xs text-green-700 uppercase font-bold tracking-wide mb-1">Honors Received</p>
                        <p className="text-sm font-medium text-green-900 m-0">
                          Dean's List: {summary.terms?.filter(t => t.deans_list?.eligible).length || 0} times<br/>
                          President's List: {summary.years?.filter(y => y.presidents_list?.eligible).length || 0} times
                        </p>
                     </div>
                     <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                        <p className="text-xs text-green-700 uppercase font-bold tracking-wide mb-1">Latin Honors</p>
                        <p className="text-lg font-bold text-green-900 m-0">{summary.latin_honors?.honor || 'Not Eligible'}</p>
                        {summary.latin_honors?.reason && (
                          <p className="text-[10px] text-green-700 mt-1 mb-0 leading-tight">{summary.latin_honors.reason}</p>
                        )}
                     </div>
                  </div>
                )}
              </div>
            </div>
          ) : next_allowed_term.ineligible_max_residency ? (
            /* ── RED: Maximum residency reached — enrollment ineligible ── */
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-800 flex items-start gap-3">
              <FiXCircle className="text-red-600 text-xl mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold m-0 text-sm text-red-900">Enrollment Ineligible</p>
                <p className="m-0 mt-1 text-sm font-medium text-red-700">Maximum Residency Period Reached</p>
                <p className="m-0 mt-1 text-sm">
                  Student is no longer eligible to enroll because the maximum residency period has been reached.
                  Remaining academic requirements can no longer be completed within the allowed residency period.
                </p>
                {progress.residency?.remaining_required_subjects?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Remaining required subjects ({progress.residency.remaining_required_units} units):</p>
                    <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                      {progress.residency.remaining_required_subjects.slice(0, 8).map(s => (
                        <li key={s.subject_id}>{s.subject_code} – {s.subject_title} ({s.units} units)</li>
                      ))}
                      {progress.residency.remaining_required_subjects.length > 8 && (
                        <li>…and {progress.residency.remaining_required_subjects.length - 8} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── YELLOW: Cannot add yet — incomplete grades or other blocking reason ── */
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800 flex items-start gap-3">
              <FiClock className="text-yellow-600 text-xl mt-0.5" />
              <div>
                <p className="font-semibold m-0 text-sm">Cannot Add Next Term</p>
                <p className="m-0 mt-1 text-sm">{next_allowed_term.blocking_reason}</p>
                {next_allowed_term.is_fifth_year_extension && (
                  <p className="m-0 mt-2 text-xs text-yellow-700 font-medium">
                    This student is in the 5th-year extension period. Complete outstanding grades to proceed.
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            {/* ── AMBER WARNING: 5th-year extension period active ── */}
            {next_allowed_term.is_fifth_year_extension && (
              <div className="mb-5 p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                <FiAlertTriangle className="text-amber-600 text-xl mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold m-0 text-sm text-amber-900">5th-Year Extension Period</p>
                  <p className="m-0 mt-1 text-sm text-amber-800">
                    This student is in the 5th-year extension period (maximum residency: 5 years).
                    Enrollment is allowed only for remaining required subjects and retakes.
                    Remaining required units: <strong>{progress.residency?.remaining_required_units ?? '—'}</strong>.
                  </p>
                </div>
              </div>
            )}

          <form onSubmit={handleAddNextTerm}>
            <div className="flex flex-wrap items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide m-0">Year Level</p>
                <p className="text-lg font-semibold text-gray-900 m-0">{ordinal(next_allowed_term.year_level)} Year</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide m-0">Semester</p>
                <p className="text-lg font-semibold text-gray-900 m-0">{Number(next_allowed_term.semester) === 1 ? '1st' : '2nd'} Semester</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide m-0">Academic Year</p>
                <p className="text-lg font-semibold text-gray-900 m-0">{next_allowed_term.academic_year}</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-4 text-left w-12"></th>
                    <th className="py-2.5 px-4 text-left font-medium">Code</th>
                    <th className="py-2.5 px-4 text-left font-medium">Title</th>
                    <th className="py-2.5 px-4 text-center font-medium">Units</th>
                    <th className="py-2.5 px-4 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {available_subjects.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-gray-500">No subjects available for enrollment in this term.</td>
                    </tr>
                  ) : (
                    available_subjects.map((subj) => {
                      const isChecked = selectedSubjects.includes(subj.subject_id);
                      const isDisabled = !subj.eligible;
                      return (
                        <tr key={subj.subject_id} className={`${isDisabled ? 'bg-gray-50 opacity-75' : 'hover:bg-blue-50/30'}`}>
                          <td className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-tmcc rounded border-gray-300 focus:ring-tmcc disabled:opacity-50"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => toggleSubject(subj.subject_id, false)}
                            />
                          </td>
                          <td className="py-2.5 px-4 font-medium text-gray-900">{subj.subject_code}</td>
                          <td className="py-2.5 px-4 text-gray-700">
                            {subj.subject_title}
                            {subj.is_retake && <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Retake</span>}
                          </td>
                          <td className="py-2.5 px-4 text-center text-gray-600">{subj.units}</td>
                          <td className="py-2.5 px-4 text-xs">
                            {!subj.eligible && <span className="text-red-600 font-medium">{subj.blocked_reason}</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Academic Load Summary ── */}
            {(() => {
              const cfg = {
                empty:                   { container: 'bg-gray-50 border-gray-200',   badge: 'bg-gray-100 text-gray-500',    icon: FiInfo,          label: 'No Selection',        msg: 'Select subjects to calculate your academic load.' },
                valid:                   { container: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', icon: FiCheckCircle,   label: 'Valid Load',          msg: null },
                valid_underload_exception:{ container: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', icon: FiAlertTriangle, label: 'Underload Exception', msg: `Only ${maxEligibleUnits} eligible unit(s) are available for this term due to curriculum and prerequisite constraints. Enrollment is allowed.` },
                above_maximum:           { container: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-800',     icon: FiXCircle,       label: 'Above Maximum',       msg: `Selected ${selectedUnits} units exceed the ${LOAD_MAX}-unit maximum. Remove subjects before enrolling.` },
                below_minimum:           { container: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-800', icon: FiAlertTriangle, label: 'Below Minimum',    msg: `Selected units (${selectedUnits}) are below the ${LOAD_MIN}-unit minimum. Add more eligible subjects before enrolling.` },
              }[loadStatus] ?? { container: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-500', icon: FiInfo, label: 'No Selection', msg: null };
              const Icon = cfg.icon;
              return (
                <div className="mt-4 space-y-1.5">
                  <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 rounded-lg border ${cfg.container}`}>
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
                      <span className="text-gray-700 font-medium">
                        Selected Units:{' '}
                        <span className="text-lg font-black">{selectedUnits}</span>
                        <span className="font-normal text-gray-400"> / {LOAD_MAX}</span>
                      </span>
                      <span className="text-gray-500 text-xs">Minimum Required: {LOAD_MIN}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.badge}`}>
                      <Icon className="shrink-0" />
                      {cfg.label}
                    </span>
                  </div>
                  {cfg.msg && (
                    <p className={`text-xs m-0 px-1 ${loadStatus === 'valid_underload_exception' ? 'text-amber-700' : loadStatus === 'above_maximum' || loadStatus === 'below_minimum' ? 'text-red-600' : 'text-gray-500'}`}>
                      {cfg.msg}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={addNextTermMutation.isLoading || !isLoadValid}
                className="inline-flex items-center gap-2 py-2 px-5 bg-tmcc text-white font-medium rounded-lg hover:bg-tmcc-dark disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                <FiPlus /> Enroll Selected Subjects
              </button>
            </div>
          </form>
          </>
        )}
      </div>
    </div>
  );
}
