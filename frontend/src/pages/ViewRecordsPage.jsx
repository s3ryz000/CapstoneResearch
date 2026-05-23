import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiEdit2, FiChevronLeft, FiChevronRight, FiDownload } from 'react-icons/fi';
import { parseApiError } from '../lib/api/errors';
import { staffToast } from '../lib/notifications';
import { staffApi } from '../lib/api/staffApi';
import { useViewRecordsStudentsListQuery } from '../hooks/useViewRecordsStudentsListQuery';
import { useViewRecordsStudentDetailQuery } from '../hooks/useViewRecordsStudentDetailQuery';
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
  const [transcriptDownloading, setTranscriptDownloading] = useState(false);

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
    isFetching: detailFetching,
  } = detailQuery;

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

  const gradeRows = useMemo(() => {
    const grades = student?.grades;
    return Array.isArray(grades) ? grades : [];
  }, [student]);

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
                  <button
                    type="button"
                    onClick={handleDownloadTranscript}
                    disabled={!student || detailLoading || transcriptDownloading}
                    className="inline-flex items-center gap-2 shrink-0 py-2 px-3 rounded-lg text-sm font-medium bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    aria-label="Download official transcript"
                  >
                    <FiDownload className="w-4 h-4 shrink-0" aria-hidden />
                    {transcriptDownloading ? 'Preparing…' : 'Download transcript'}
                  </button>
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
                  <div className="overflow-x-auto">
                    {detailFetching && !detailLoading && (
                      <p className="text-xs text-gray-400 mb-2">Refreshing grades…</p>
                    )}
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-3 px-3 font-semibold text-gray-700">Subject</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700">A.Y.</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700">Semester</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700">Grade</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 px-3 text-center text-gray-500 italic">
                              No grades on file.
                            </td>
                          </tr>
                        ) : (
                          gradeRows.map((g) => (
                            <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                              <td className="py-2.5 px-3 text-gray-900">
                                {g.subject?.code ? `${g.subject.code} — ` : ''}
                                {g.subject?.title ?? '—'}
                              </td>
                              <td className="py-2.5 px-3 text-gray-700">{g.academic_year ?? '—'}</td>
                              <td className="py-2.5 px-3 text-gray-700">{g.semester ?? '—'}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-900">
                                {g.grade_value != null ? Number(g.grade_value).toFixed(2) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">{g.remarks ?? '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
