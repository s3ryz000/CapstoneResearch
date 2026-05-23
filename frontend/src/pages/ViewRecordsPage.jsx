import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiEdit2, FiChevronLeft, FiChevronRight, FiDownload, FiSearch, FiLayers, FiFileText } from 'react-icons/fi';
import jsPDF from 'jspdf';
import { parseApiError } from '../lib/api/errors';
import { staffToast } from '../lib/notifications';
import { staffApi } from '../lib/api/staffApi';
import { useViewRecordsStudentsListQuery } from '../hooks/useViewRecordsStudentsListQuery';
import { useViewRecordsStudentDetailQuery } from '../hooks/useViewRecordsStudentDetailQuery';
import { useViewRecordsAcademicSummaryQuery } from '../hooks/useViewRecordsAcademicSummaryQuery';
import {
  VIEW_RECORDS_DEFAULT_PER_PAGE,
  VIEW_RECORDS_PER_PAGE_OPTIONS,
  VIEW_RECORDS_SEARCH_DEBOUNCE_MS,
  VIEW_RECORDS_SORT_OPTIONS,
} from '../features/viewRecords/constants';
import { deriveStatusLabel, mapStudentToListRow } from '../features/viewRecords/mapStudentRow';

const ViewRecordsPage = () => {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/staff';

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(VIEW_RECORDS_DEFAULT_PER_PAGE);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [academicViewMode, setAcademicViewMode] = useState(null); // null, 'subjects', 'documents'
  const [transcriptDownloading, setTranscriptDownloading] = useState(false);

  const [searchCode, setSearchCode] = useState('');
  const [filterAy, setFilterAy] = useState('');
  const [filterYr, setFilterYr] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), VIEW_RECORDS_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortKey, sortDir, perPage]);

  const listQuery = useViewRecordsStudentsListQuery({
    page,
    perPage,
    search: debouncedSearch,
    sort: sortKey,
    dir: sortDir,
  });

  const {
    data: listPayload,
    isLoading: listIsLoading,
    isFetching: listIsFetching,
    isError: listError,
    error: listErr,
    isPlaceholderData: listIsPlaceholder,
    total,
    lastPage,
    from,
    to,
    currentPage,
  } = listQuery;

  const rows = useMemo(() => {
    const raw = listPayload?.data;
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapStudentToListRow);
  }, [listPayload]);

  /** Sync selection with current (non-placeholder) page rows only. */
  useEffect(() => {
    if (listIsPlaceholder) return;
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.student_id === selectedId)) {
      setSelectedId(rows[0].student_id);
    }
  }, [rows, selectedId, listIsPlaceholder]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.student_id === selectedId) || null,
    [rows, selectedId],
  );

  const detailQuery = useViewRecordsStudentDetailQuery(selectedId);
  const {
    data: detailPayload,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
  } = detailQuery;



  const summaryQuery = useViewRecordsAcademicSummaryQuery(selectedId);
  const {
    data: summaryPayload,
    isLoading: summaryLoading,
  } = summaryQuery;

  const student = detailPayload?.student ?? null;

  const listInitialLoading = listIsLoading && !listPayload;
  const listUpdating = listIsFetching && !listInitialLoading;

  const listErrorMsg = listError ? parseApiError(listErr).message || 'Failed to load students.' : null;
  const detailErrorMsg = detailError ? parseApiError(detailErr).message || 'Failed to load student.' : null;

  const applySearch = useCallback(() => {
    setDebouncedSearch(searchInput.trim());
  }, [searchInput]);

  const handleDownloadTranscript = useCallback(async () => {
    if (!selectedId || !student) return;
    setTranscriptDownloading(true);
    try {
      const response = await staffApi.downloadStudentTranscript(selectedId);
      const blob = response.data;
      const disposition = response.headers?.['content-disposition'] || '';
      const matchedName = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        matchedName?.[1] || `OFFICIAL_TRANSCRIPT_${student.student_number ?? selectedId}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      staffToast.success('Transcript downloaded', 'The official transcript was saved as .pdf.');
    } catch (err) {
      const parsed = parseApiError(err);
      staffToast.error('Download failed', parsed.message || 'Could not download transcript.');
    } finally {
      setTranscriptDownloading(false);
    }
  }, [selectedId, student]);

  const generateAwardPdf = useCallback((awardName, ay, sem) => {
    if (!student) return;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont('times', 'bold');
    doc.text('Trece Martires City College', 105, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    doc.text('Automated Student Records Management System', 105, 40, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('times', 'bold');
    doc.text('CERTIFICATE OF ELIGIBILITY', 105, 60, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    
    const studentName = student.first_name + ' ' + student.last_name;
    const studentId = student.student_number || student.student_id;
    const programName = student.program?.name || 'N/A';
    const computedGwa = summaryPayload?.summary?.overall_gwa || 'N/A';
    
    let text = `This certifies that ${studentName}, ${studentId}, from ${programName}, is eligible for ${awardName} for ${ay}`;
    if (sem) {
      text += ` ${sem}`;
    }
    text += `, based on computed academic records in the Automated Student Records Management System.`;

    const splitText = doc.splitTextToSize(text, 170);
    doc.text(splitText, 20, 80);

    doc.text(`Computed GWA: ${Number(computedGwa).toFixed(2)}`, 20, 120);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, 130);

    doc.save(`${awardName.replace(/\s+/g, '_')}_${studentId}.pdf`);
  }, [student, summaryPayload]);

  const onSortChange = (e) => {
    const v = e.target.value;
    if (!v) return;
    const [k, d] = v.split('|');
    setSortKey(k);
    setSortDir(d);
  };

  const sortSelectValue = `${sortKey}|${sortDir}`;

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => Math.min(lastPage, p + 1)), [lastPage]);

  const statusBadgeClass = (label) => {
    const u = String(label || '').toLowerCase();
    if (u === 'pending') return 'bg-cyan-100 text-cyan-900';
    if (u === 'enrolled') return 'bg-teal-200 text-teal-900';
    if (u === 'graduated') return 'bg-slate-200 text-slate-800';
    return 'bg-teal-100 text-teal-900';
  };

  const getSubjectStatusBadgeClass = (status) => {
    if (status === 'Completed') return 'bg-green-100 text-green-800';
    if (status === 'Currently Enrolled') return 'bg-blue-100 text-blue-800';
    if (status === 'Failed - Retake Required') return 'bg-red-100 text-red-800';
    if (status === 'Incomplete') return 'bg-orange-100 text-orange-800';
    if (status?.includes('Blocked')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-50 text-gray-600';
  };

  const filteredRoadmap = useMemo(() => {
    const roadmap = summaryPayload?.curriculum?.roadmap || [];
    return roadmap.filter((item) => {
      const matchSearch =
        item.subject_code.toLowerCase().includes(searchCode.toLowerCase()) ||
        item.subject_description.toLowerCase().includes(searchCode.toLowerCase());
      const matchAy = filterAy ? item.academic_year === filterAy : true;
      const matchYr = filterYr ? String(item.curriculum_year_level) === filterYr : true;
      const matchSem = filterSem ? String(item.curriculum_semester) === filterSem : true;
      let matchStatus = true;
      if (filterStatus) {
        if (filterStatus === 'Completed') matchStatus = item.status === 'Completed';
        else if (filterStatus === 'Enrolled') matchStatus = item.status === 'Currently Enrolled';
        else if (filterStatus === 'Failed') matchStatus = item.status === 'Failed - Retake Required';
        else if (filterStatus === 'Blocked') matchStatus = item.status.includes('Blocked');
        else if (filterStatus === 'Eligible') matchStatus = item.status === 'Eligible to Take' || item.status === 'Not Yet Taken';
      }
      return matchSearch && matchAy && matchYr && matchSem && matchStatus;
    });
  }, [summaryPayload, searchCode, filterAy, filterYr, filterSem, filterStatus]);

  const documentsList = useMemo(() => {
    if (!summaryPayload) return [];
    const list = [];
    
    // Transcript is always available
    list.push({
      ay: 'All',
      sem: 'All',
      type: 'Academic Record',
      name: 'Transcript of Records',
      status: 'Available',
      actionType: 'transcript'
    });

    // Certificate of Grades
    list.push({
      ay: 'All',
      sem: 'All',
      type: 'Academic Record',
      name: 'Certificate of Grades',
      status: 'Available',
      actionType: 'cog'
    });

    const summary = summaryPayload.summary;
    if (summary) {
      // Latin Honors
      if (summary.latin_honors?.eligible) {
        list.push({
          ay: 'Overall',
          sem: 'Graduation',
          type: 'Latin Honor',
          name: summary.latin_honors.honor,
          status: 'Eligible',
          actionType: 'latin_honor'
        });
      }

      // Presidents List
      if (summary.years) {
        summary.years.forEach(yr => {
          if (yr.presidents_list?.eligible) {
            list.push({
              ay: yr.academic_year,
              sem: 'All',
              type: 'Academic Award',
              name: 'President\'s List',
              status: 'Eligible',
              actionType: 'presidents_list'
            });
          }
        });
      }

      // Deans List
      if (summary.terms) {
        summary.terms.forEach(term => {
          if (term.deans_list?.eligible) {
            list.push({
              ay: term.academic_year,
              sem: term.semester,
              type: 'Academic Award',
              name: 'Dean\'s List',
              status: 'Eligible',
              actionType: 'deans_list'
            });
          }
        });
      }
    }
    return list;
  }, [summaryPayload]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-2xl font-bold text-gray-800">Student Records</h2>
        <Link
          to={`${basePath}/students`}
          className="text-sm font-medium text-tmcc hover:text-tmcc-dark no-underline"
        >
          Manage students →
        </Link>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100">
        <div className="flex flex-wrap gap-3 items-stretch">
          <input
            type="search"
            placeholder="Search student by name or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            className="flex-1 min-w-[200px] py-2.5 px-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/25 focus:border-tmcc"
            aria-label="Search students"
          />
          <button
            type="button"
            onClick={applySearch}
            className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-tmcc text-white hover:bg-tmcc-dark shadow-sm shrink-0"
          >
            Search
          </button>
        </div>
      </div>

      {listErrorMsg && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {listErrorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-6 items-start">
        <section className="rounded-xl bg-white border border-gray-100 shadow-[0_4px_14px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col max-h-[min(70vh,640px)]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            <h3 className="m-0 text-base font-semibold text-tmcc">Students</h3>
            <select
              value={sortSelectValue}
              onChange={onSortChange}
              className="text-xs py-1.5 px-2 border border-gray-300 rounded-lg bg-white max-w-[180px]"
              aria-label="Sort students"
            >
              {VIEW_RECORDS_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-y-auto flex-1 p-2 min-h-0">
            {listInitialLoading ? (
              <p className="text-sm text-gray-500 px-2 py-6 text-center">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500 px-2 py-6 text-center italic">No students found.</p>
            ) : (
              <ul className="space-y-1 m-0 p-0 list-none">
                {rows.map((r) => {
                  const active = r.student_id === selectedId;
                  return (
                    <li key={r.student_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(r.student_id);
                          setActiveTab('profile');
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${
                          active
                            ? 'bg-green-50 border-tmcc/40 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <span className="block text-sm font-medium text-blue-700 leading-snug">
                          {r.displayName}
                        </span>
                        <span className="block text-xs text-gray-600 mt-0.5">
                          ID: {r.student_number ?? r.student_id}
                        </span>
                        <span
                          className={`inline-block mt-1.5 py-0.5 px-2 rounded-full text-[11px] font-semibold ${statusBadgeClass(r.statusLabel)}`}
                        >
                          {r.statusLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {total > 0 && (
            <div className="shrink-0 px-3 py-2.5 border-t border-gray-100 bg-gray-50/80 text-xs text-gray-600 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Showing {from}–{to} of {total}
                  {listUpdating ? <span className="ml-1 text-gray-400">(updating…)</span> : null}
                </span>
                <label className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-gray-500">Per page</span>
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="py-1 px-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    {VIEW_RECORDS_PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={page <= 1 || listInitialLoading}
                  className="inline-flex items-center gap-1 py-1.5 px-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-gray-700 tabular-nums">
                  Page {currentPage} of {lastPage}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={page >= lastPage || listInitialLoading}
                  className="inline-flex items-center gap-1 py-1.5 px-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white border border-gray-100 shadow-[0_4px_14px_rgba(0,0,0,0.08)] overflow-hidden min-h-[420px]">
          {!selectedId ? (
            <p className="p-8 text-center text-gray-500">Select a student from the list.</p>
          ) : (
            <>
              <div className="px-6 pt-5 pb-0 border-b border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <h3 className="m-0 text-lg font-semibold text-tmcc flex-1 min-w-0 pr-2">
                    {selectedRow ? selectedRow.displayName : '…'}
                  </h3>
                </div>
                <div className="flex gap-6 border-b border-transparent">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === 'profile'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('academic')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === 'academic'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Academic Records
                  </button>
                </div>
              </div>

              <div className="p-6">
                {detailLoading && !student && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-10 h-10 border-2 border-tmcc border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-600">Loading profile…</p>
                  </div>
                )}

                {detailErrorMsg && !detailLoading && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
                    {detailErrorMsg}
                  </div>
                )}

                {student && activeTab === 'profile' && (
                  <div className="space-y-5">
                    <div className="rounded-xl overflow-hidden border border-teal-200/80 shadow-sm">
                      <div className="flex items-center gap-3 px-4 py-3 bg-teal-500 text-white">
                        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/20">
                          <FiUser className="w-5 h-5" />
                        </span>
                        <span className="font-semibold text-[0.95rem]">Student information</span>
                      </div>
                      <dl className="divide-y divide-gray-100 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">ID</dt>
                          <dd className="m-0 text-sm text-gray-900 font-medium">
                            {student.student_number ?? student.student_id ?? '—'}
                          </dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Status</dt>
                          <dd className="m-0">
                            <span
                              className={`inline-block py-1 px-2.5 rounded-full text-xs font-semibold ${statusBadgeClass(deriveStatusLabel(student))}`}
                            >
                              {deriveStatusLabel(student)}
                            </span>
                          </dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Course</dt>
                          <dd className="m-0 text-sm text-gray-900">
                            {student.program?.name || student.program?.code || '—'}
                          </dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Year level</dt>
                          <dd className="m-0 text-sm text-gray-900">N/A</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Major</dt>
                          <dd className="m-0 text-sm text-gray-900">N/A</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Overall GWA (Computed)</dt>
                          <dd className="m-0 text-sm text-gray-900 font-bold">
                            {student.GPA != null ? Number(student.GPA).toFixed(2) : '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-amber-200/90 shadow-sm">
                      <div className="flex items-center gap-3 px-4 py-3 bg-amber-400 text-gray-900">
                        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/40">
                          <FiMail className="w-5 h-5" />
                        </span>
                        <span className="font-semibold text-[0.95rem]">Contact information</span>
                      </div>
                      <dl className="divide-y divide-gray-100 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Email</dt>
                          <dd className="m-0 text-sm text-gray-900 break-all">{student.email ?? '—'}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Contact</dt>
                          <dd className="m-0 text-sm text-gray-900">{student.contact_number ?? '—'}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 px-4 py-3">
                          <dt className="text-xs font-medium text-gray-500 uppercase w-40 shrink-0">Address</dt>
                          <dd className="m-0 text-sm text-gray-900">
                            {student.address && String(student.address).trim() ? student.address : '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Link
                        to={`${basePath}/students/${student.student_id}/edit`}
                        state={{ student }}
                        className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 no-underline shadow-sm"
                      >
                        <FiEdit2 className="w-4 h-4" />
                        Edit student
                      </Link>
                    </div>
                  </div>
                )}

                {student && activeTab === 'academic' && (
                  <div className="space-y-6">
                    {/* View Options */}
                    {!academicViewMode && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <button
                          onClick={() => setAcademicViewMode('subjects')}
                          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-sm"
                        >
                          <FiLayers className="w-8 h-8 text-blue-500 mb-3" />
                          <span className="text-lg font-semibold text-gray-800">View Subjects and Grades</span>
                          <span className="text-sm text-gray-500 mt-1">Review the full curriculum roadmap and academic standing</span>
                        </button>
                        
                        <button
                          onClick={() => setAcademicViewMode('documents')}
                          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors shadow-sm"
                        >
                          <FiFileText className="w-8 h-8 text-green-500 mb-3" />
                          <span className="text-lg font-semibold text-gray-800">Download Documents and Awards</span>
                          <span className="text-sm text-gray-500 mt-1">Generate transcripts and honor certificates</span>
                        </button>
                      </div>
                    )}

                    {/* Subjects and Grades View */}
                    {academicViewMode === 'subjects' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <button onClick={() => setAcademicViewMode(null)} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                            <FiChevronLeft /> Back to options
                          </button>
                        </div>

                        <div className="p-4 border border-gray-200 bg-gray-50 rounded-lg flex flex-wrap gap-4 items-center">
                          <div className="flex-1 min-w-[200px] relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search code or description..."
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
                              value={searchCode}
                              onChange={(e) => setSearchCode(e.target.value)}
                            />
                          </div>
                          
                          <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm" value={filterAy} onChange={(e) => setFilterAy(e.target.value)}>
                            <option value="">All Academic Years</option>
                            {Array.from(new Set(summaryPayload?.curriculum?.roadmap?.map(r => r.academic_year).filter(Boolean))).map(ay => (
                              <option key={ay} value={ay}>{ay}</option>
                            ))}
                          </select>
                          <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm" value={filterYr} onChange={(e) => setFilterYr(e.target.value)}>
                            <option value="">All Years</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                          </select>
                          <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm" value={filterSem} onChange={(e) => setFilterSem(e.target.value)}>
                            <option value="">All Semesters</option>
                            <option value="1">1st Semester</option>
                            <option value="2">2nd Semester</option>
                          </select>
                          <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Enrolled">Currently Enrolled</option>
                            <option value="Failed">Failed</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Eligible">Eligible / Not Taken</option>
                          </select>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm border-collapse bg-white">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Code</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">A.Y.</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Yr/Sem</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Units</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Grade</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Remarks</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryLoading ? (
                                <tr><td colSpan="8" className="py-8 text-center text-gray-500">Loading...</td></tr>
                              ) : filteredRoadmap.length === 0 ? (
                                <tr><td colSpan="8" className="py-8 text-center text-gray-500">No subjects match your filters.</td></tr>
                              ) : (
                                filteredRoadmap.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2.5 px-4 font-medium text-gray-900 whitespace-nowrap">{item.subject_code}</td>
                                    <td className="py-2.5 px-4">{item.subject_description}</td>
                                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">{item.academic_year || '-'}</td>
                                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">Y{item.curriculum_year_level} S{item.curriculum_semester}</td>
                                    <td className="py-2.5 px-4 text-gray-600">{item.units}</td>
                                    <td className="py-2.5 px-4 font-medium text-gray-900">{item.grade ? Number(item.grade).toFixed(2) : '-'}</td>
                                    <td className="py-2.5 px-4 text-gray-600">{item.remarks || '-'}</td>
                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSubjectStatusBadgeClass(item.status)}`}>
                                        {item.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Documents and Awards View */}
                    {academicViewMode === 'documents' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <button onClick={() => setAcademicViewMode(null)} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                            <FiChevronLeft /> Back to options
                          </button>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm border-collapse bg-white">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">A.Y.</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Semester</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Document Type</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Document Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Eligibility Status</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryLoading ? (
                                <tr><td colSpan="6" className="py-8 text-center text-gray-500">Loading...</td></tr>
                              ) : documentsList.length === 0 ? (
                                <tr><td colSpan="6" className="py-8 text-center text-gray-500">No documents available.</td></tr>
                              ) : (
                                documentsList.map((doc, idx) => (
                                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{doc.ay}</td>
                                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{doc.sem}</td>
                                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{doc.type}</td>
                                    <td className="py-3 px-4 font-medium text-gray-900">{doc.name}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${doc.status === 'Available' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {doc.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <button
                                        onClick={() => {
                                          if (doc.actionType === 'transcript') handleDownloadTranscript();
                                          else if (doc.actionType === 'cog') staffToast.info('Certificate of Grades', 'Not fully implemented yet.');
                                          else generateAwardPdf(doc.name, doc.ay, doc.sem);
                                        }}
                                        disabled={transcriptDownloading && doc.actionType === 'transcript'}
                                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded text-sm font-medium bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-50"
                                      >
                                        <FiDownload className="w-4 h-4" />
                                        Download PDF
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ViewRecordsPage;
