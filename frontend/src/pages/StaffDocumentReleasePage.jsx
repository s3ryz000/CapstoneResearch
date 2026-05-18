import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiPackage, FiSearch, FiChevronUp, FiChevronDown, FiPrinter } from 'react-icons/fi';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { staffToast } from '../lib/notifications';
import { staffApi } from '../lib/api/staffApi';
import { parseApiError } from '../lib/api/errors';

const ENTRIES_OPTIONS = [5, 10, 25, 50];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sortData = (data, key, dir) => {
  if (!data.length) return data;
  const mult = dir === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (typeof va === 'string') va = (va || '').toLowerCase();
    if (typeof vb === 'string') vb = (vb || '').toLowerCase();
    if (va < vb) return -1 * mult;
    if (va > vb) return 1 * mult;
    return 0;
  });
};

const StaffDocumentReleasePage = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [approvedForRelease, setApprovedForRelease] = useState([]);
  const [releasedRequests, setReleasedRequests] = useState([]);
  const [releaseSearch, setReleaseSearch] = useState('');
  const [releaseFilterType, setReleaseFilterType] = useState('');
  const [releaseSortKey, setReleaseSortKey] = useState('processed_at');
  const [releaseSortDir, setReleaseSortDir] = useState('desc');
  const [releaseEntries, setReleaseEntries] = useState(10);
  const [releasePage, setReleasePage] = useState(1);
  const [releaseConfirm, setReleaseConfirm] = useState(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releasedSearch, setReleasedSearch] = useState('');
  const [releasedFilterType, setReleasedFilterType] = useState('');
  const [releasedSortKey, setReleasedSortKey] = useState('released_at');
  const [releasedSortDir, setReleasedSortDir] = useState('desc');
  const [releasedEntries, setReleasedEntries] = useState(10);
  const [releasedPage, setReleasedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [approvedRes, releasedRes] = await Promise.all([
        staffApi.getApprovedForRelease({ per_page: 100 }),
        staffApi.getTransactionHistory({ status: 'released', per_page: 100 }),
      ]);

      const approvedList = Array.isArray(approvedRes?.data) ? approvedRes.data : (Array.isArray(approvedRes) ? approvedRes : []);
      const releasedList = Array.isArray(releasedRes?.data) ? releasedRes.data : (Array.isArray(releasedRes) ? releasedRes : []);

      setApprovedForRelease(approvedList.map((r) => ({ ...r, approved_at: r.processed_at || r.approved_at })));
      setReleasedRequests(releasedList.map((r) => ({
        id: r.id,
        student_name: r.student_name ?? (r.student ? [r.student.first_name, r.student.last_name].filter(Boolean).join(' ') : '—'),
        record_type: r.record_type ?? '—',
        purpose: r.purpose ?? '—',
        released_at: r.released_at,
        requested_at: r.requested_at,
      })));
    } catch (err) {
      const parsed = parseApiError(err);
      setLoadError(parsed.message || 'Failed to load document release requests.');
      setApprovedForRelease([]);
      setReleasedRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleReleaseClick = (row) => {
    setReleaseConfirm(row);
  };

  const onConfirmRelease = async () => {
    if (!releaseConfirm) return;
    setReleaseLoading(true);
    const { id, student_name, record_type } = releaseConfirm;
    try {
      await staffApi.releaseDocument(id);
      setApprovedForRelease((prev) => prev.filter((r) => r.id !== id));
      await fetchRows();
      setReleaseConfirm(null);
      staffToast.success('Document released', `${student_name}'s ${record_type} has been released and recorded.`);
    } catch (err) {
      const parsed = parseApiError(err);
      staffToast.error('Release failed', parsed.message || 'Could not release document.');
    } finally {
      setReleaseLoading(false);
    }
  };

  const toggleSort = (key) => {
    if (key === releaseSortKey) setReleaseSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setReleaseSortKey(key);
      setReleaseSortDir('asc');
    }
  };

  const toggleReleasedSort = (key) => {
    if (key === releasedSortKey) setReleasedSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setReleasedSortKey(key);
      setReleasedSortDir('asc');
    }
  };

  const SortableTh = ({ label, sortKey }) => (
    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-tmcc/30 rounded"
        onClick={() => toggleSort(sortKey)}
      >
        {label}
        {releaseSortKey === sortKey ? (
          releaseSortDir === 'asc' ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 inline-block opacity-40"><FiChevronUp className="w-3 h-3" /></span>
        )}
      </button>
    </th>
  );

  const ReleasedSortableTh = ({ label, sortKey }) => (
    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-tmcc/30 rounded"
        onClick={() => toggleReleasedSort(sortKey)}
      >
        {label}
        {releasedSortKey === sortKey ? (
          releasedSortDir === 'asc' ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 inline-block opacity-40"><FiChevronUp className="w-3 h-3" /></span>
        )}
      </button>
    </th>
  );

  const releaseFiltered = useMemo(() => {
    let list = approvedForRelease.filter((r) => {
      const matchSearch = !releaseSearch || [r.student_name, r.record_type, r.purpose].some((v) =>
        String(v || '').toLowerCase().includes(releaseSearch.toLowerCase())
      );
      const matchType = !releaseFilterType || r.record_type === releaseFilterType;
      return matchSearch && matchType;
    });
    return sortData(list, releaseSortKey, releaseSortDir);
  }, [approvedForRelease, releaseSearch, releaseFilterType, releaseSortKey, releaseSortDir]);

  const releasePaginated = useMemo(() => {
    const start = (releasePage - 1) * releaseEntries;
    return releaseFiltered.slice(start, start + releaseEntries);
  }, [releaseFiltered, releasePage, releaseEntries]);

  const releaseRecordTypes = useMemo(() => [...new Set(approvedForRelease.map((r) => r.record_type))], [approvedForRelease]);
  const releasedFiltered = useMemo(() => {
    let list = releasedRequests.filter((r) => {
      const matchSearch = !releasedSearch || [r.student_name, r.record_type, r.purpose].some((v) =>
        String(v || '').toLowerCase().includes(releasedSearch.toLowerCase())
      );
      const matchType = !releasedFilterType || r.record_type === releasedFilterType;
      return matchSearch && matchType;
    });
    return sortData(list, releasedSortKey, releasedSortDir);
  }, [releasedRequests, releasedSearch, releasedFilterType, releasedSortKey, releasedSortDir]);

  const releasedPaginated = useMemo(() => {
    const start = (releasedPage - 1) * releasedEntries;
    return releasedFiltered.slice(start, start + releasedEntries);
  }, [releasedFiltered, releasedPage, releasedEntries]);

  const releasedRecordTypes = useMemo(() => [...new Set(releasedRequests.map((r) => r.record_type))], [releasedRequests]);

  const handlePrint = async (row) => {
    const isTranscript = String(row.record_type || '').trim().toLowerCase() === 'transcript';
    if (isTranscript) {
      try {
        const response = await staffApi.downloadTranscriptTemplate(row.id);
        const blob = response.data;
        const disposition = response.headers?.['content-disposition'] || '';
        const matchedName = disposition.match(/filename="?([^"]+)"?/i);
        const filename = matchedName?.[1] || `OFFICIAL_TRANSCRIPT_OF_RECORD_${row.id}.pdf`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        staffToast.success('Transcript downloaded', 'The official transcript was downloaded as .pdf.');
      } catch (err) {
        const parsed = parseApiError(err);
        staffToast.error('Download failed', parsed.message || 'Could not download transcript template.');
      }
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      staffToast.error('Print blocked', 'Please allow pop-ups in your browser to print the release slip.');
      return;
    }

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Document Release Slip</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          .wrap { max-width: 760px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
          h1 { margin: 0 0 4px 0; font-size: 22px; }
          p.sub { margin: 0 0 20px 0; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 14px; }
          th { background: #f9fafb; width: 220px; }
          .foot { margin-top: 28px; font-size: 12px; color: #6b7280; }
          @media print { body { margin: 0; } .wrap { border: none; } }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Document Release Slip</h1>
          <p class="sub">Generated by Staff Document Release module</p>
          <table>
            <tr><th>Student Name</th><td>${row.student_name || '—'}</td></tr>
            <tr><th>Record Type</th><td>${row.record_type || '—'}</td></tr>
            <tr><th>Purpose</th><td>${row.purpose || '—'}</td></tr>
            <tr><th>Released At</th><td>${formatDateTime(row.released_at)}</td></tr>
            <tr><th>Requested At</th><td>${formatDateTime(row.requested_at)}</td></tr>
          </table>
          <p class="foot">This printout serves as release transaction reference.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <>
      <section className="mb-6">
        <h2 className="m-0 text-2xl font-bold text-gray-800">Document Release</h2>
        <p className="mt-1 m-0 text-gray-600 text-sm">Release approved documents and record transactions.</p>
      </section>
      {loadError && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {loadError}
        </div>
      )}
      <section className="bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="px-6 pt-6">
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'pending' ? 'bg-white text-tmcc shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              For Release
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('released')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'released' ? 'bg-white text-tmcc shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Released
            </button>
          </div>
        </div>
        {activeTab === 'pending' ? (
          <>
        <div className="p-6 border-b border-gray-100">
          <h3 className="mt-0 mb-2 text-lg font-semibold text-gray-800">Approved requests ready for release</h3>
          <p className="m-0 mb-4 text-sm text-gray-600">Click Release to record the transaction. Status will update to released.</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search..."
                value={releaseSearch}
                onChange={(e) => { setReleaseSearch(e.target.value); setReleasePage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                aria-label="Search document release"
              />
            </div>
            <select
              value={releaseFilterType}
              onChange={(e) => { setReleaseFilterType(e.target.value); setReleasePage(1); }}
              className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
              aria-label="Filter by record type"
            >
              <option value="">All record types</option>
              {releaseRecordTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select
                value={releaseEntries}
                onChange={(e) => { setReleaseEntries(Number(e.target.value)); setReleasePage(1); }}
                className="py-1.5 px-2 border border-gray-300 rounded text-sm"
              >
                {ENTRIES_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>entries</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <SortableTh label="Student Name" sortKey="student_name" />
                <SortableTh label="Record Type" sortKey="record_type" />
                <SortableTh label="Purpose" sortKey="purpose" />
                <SortableTh label="Approved" sortKey="approved_at" />
                <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 px-4 text-center text-gray-500">Loading approved requests...</td></tr>
              ) : releasePaginated.length > 0 ? (
                releasePaginated.map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="py-3 px-4 text-gray-800">{req.student_name}</td>
                    <td className="py-3 px-4 text-gray-700">{req.record_type}</td>
                    <td className="py-3 px-4 text-gray-700">{req.purpose}</td>
                    <td className="py-3 px-4 text-gray-700">{req.approved_at}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-tmcc text-white hover:bg-tmcc-dark focus:ring-2 focus:ring-tmcc/30"
                        onClick={() => handleReleaseClick(req)}
                      >
                        <FiPackage /> Release
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="py-8 px-4 text-center text-gray-500 italic">No documents pending release.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {releaseFiltered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
            Showing {((releasePage - 1) * releaseEntries) + 1} to {Math.min(releasePage * releaseEntries, releaseFiltered.length)} of {releaseFiltered.length} entries
          </div>
        )}
          </>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100">
              <h3 className="mt-0 mb-2 text-lg font-semibold text-gray-800">Released requests</h3>
              <p className="m-0 mb-4 text-sm text-gray-600">Use Print to generate a release slip for each transaction.</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Search..."
                    value={releasedSearch}
                    onChange={(e) => { setReleasedSearch(e.target.value); setReleasedPage(1); }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                    aria-label="Search released requests"
                  />
                </div>
                <select
                  value={releasedFilterType}
                  onChange={(e) => { setReleasedFilterType(e.target.value); setReleasedPage(1); }}
                  className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                  aria-label="Filter released by record type"
                >
                  <option value="">All record types</option>
                  {releasedRecordTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Show</span>
                  <select
                    value={releasedEntries}
                    onChange={(e) => { setReleasedEntries(Number(e.target.value)); setReleasedPage(1); }}
                    className="py-1.5 px-2 border border-gray-300 rounded text-sm"
                  >
                    {ENTRIES_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span>entries</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <ReleasedSortableTh label="Student Name" sortKey="student_name" />
                    <ReleasedSortableTh label="Record Type" sortKey="record_type" />
                    <ReleasedSortableTh label="Purpose" sortKey="purpose" />
                    <ReleasedSortableTh label="Released At" sortKey="released_at" />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-8 px-4 text-center text-gray-500">Loading released requests...</td></tr>
                  ) : releasedPaginated.length > 0 ? (
                    releasedPaginated.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="py-3 px-4 text-gray-800">{req.student_name}</td>
                        <td className="py-3 px-4 text-gray-700">{req.record_type}</td>
                        <td className="py-3 px-4 text-gray-700">{req.purpose}</td>
                        <td className="py-3 px-4 text-gray-700">{formatDateTime(req.released_at)}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-300"
                            onClick={() => handlePrint(req)}
                          >
                            <FiPrinter /> {String(req.record_type || '').trim().toLowerCase() === 'transcript' ? 'Download PDF' : 'Print'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="py-8 px-4 text-center text-gray-500 italic">No released documents found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {releasedFiltered.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                Showing {((releasedPage - 1) * releasedEntries) + 1} to {Math.min(releasedPage * releasedEntries, releasedFiltered.length)} of {releasedFiltered.length} entries
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!releaseConfirm}
        onClose={() => !releaseLoading && setReleaseConfirm(null)}
        onConfirm={onConfirmRelease}
        title="Release document"
        message={
          releaseConfirm
            ? `Record the release of ${releaseConfirm.record_type} for ${releaseConfirm.student_name}? This will log the transaction.`
            : ''
        }
        confirmLabel="Release"
        cancelLabel="Cancel"
        variant="success"
        loading={releaseLoading}
      />
    </>
  );
};

export default StaffDocumentReleasePage;
