import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiCheck, FiX, FiSearch, FiChevronUp, FiChevronDown, FiInbox, FiCheckCircle, FiXCircle, FiDownload, FiAlertTriangle } from 'react-icons/fi';
import { staffToast } from '../lib/notifications';
import { staffApi } from '../lib/api/staffApi';
import { parseApiError } from '../lib/api/errors';

const ENTRIES_OPTIONS = [5, 10, 25, 50];
const TABS = [
  { id: 'requests', label: 'Requests', icon: FiInbox },
  { id: 'approved', label: 'Approved', icon: FiCheckCircle },
  { id: 'rejected', label: 'Rejected', icon: FiXCircle },
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

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

const toDateInput = (date) => date.toISOString().slice(0, 10);

const monthKeyFromDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const buildMonthCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const startDate = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);
    return current;
  });
};

const isSameDate = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const toIsoAppointment = (dateStr, timeStr) => {
  const localDate = new Date(`${dateStr}T${timeStr}:00`);
  return localDate.toISOString();
};

const saveBlob = (response, fallbackFilename) => {
  const blob = response.data;
  const disposition = response.headers?.['content-disposition'] || '';
  const matchedName = disposition.match(/filename="?([^"]+)"?/i);
  const filename = matchedName?.[1] || fallbackFilename;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const StaffPendingRequestsPage = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingFilterType, setPendingFilterType] = useState('');
  const [pendingSortKey, setPendingSortKey] = useState('requested_at');
  const [pendingSortDir, setPendingSortDir] = useState('desc');
  const [approvedSortKey, setApprovedSortKey] = useState('processed_at');
  const [approvedSortDir, setApprovedSortDir] = useState('desc');
  const [rejectedSortKey, setRejectedSortKey] = useState('processed_at');
  const [rejectedSortDir, setRejectedSortDir] = useState('desc');
  const [pendingEntries, setPendingEntries] = useState(10);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejectModal, setRejectModal] = useState(null); // { id, student_name }
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveModal, setApproveModal] = useState(null);
  const [approveMonth, setApproveMonth] = useState(new Date());
  const [slotsPayload, setSlotsPayload] = useState({ month: '', time_slots: DEFAULT_TIME_SLOTS, taken_by_date: {} });
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [approvedLoadError, setApprovedLoadError] = useState(null);
  const [rejectedLoadError, setRejectedLoadError] = useState(null);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [rejectedLoading, setRejectedLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await staffApi.getPendingRequests({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setPendingRequests(list);
    } catch (err) {
      const parsed = parseApiError(err);
      setLoadError(parsed.message || 'Failed to load pending requests.');
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApproved = useCallback(async () => {
    setApprovedLoading(true);
    setApprovedLoadError(null);
    try {
      const res = await staffApi.getApprovedRequests({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setApprovedRequests(list);
    } catch (err) {
      const parsed = parseApiError(err);
      setApprovedLoadError(parsed.message || 'Failed to load approved requests.');
      setApprovedRequests([]);
    } finally {
      setApprovedLoading(false);
    }
  }, []);

  const fetchRejected = useCallback(async () => {
    setRejectedLoading(true);
    setRejectedLoadError(null);
    try {
      const res = await staffApi.getRejectedRequests({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setRejectedRequests(list);
    } catch (err) {
      const parsed = parseApiError(err);
      setRejectedLoadError(parsed.message || 'Failed to load rejected requests.');
      setRejectedRequests([]);
    } finally {
      setRejectedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (activeTab === 'approved') fetchApproved();
  }, [activeTab, fetchApproved]);

  useEffect(() => {
    if (activeTab === 'rejected') fetchRejected();
  }, [activeTab, fetchRejected]);

  const handleReject = (id) => {
    const row = pendingRequests.find((r) => r.id === id);
    setRejectModal({ id, student_name: row?.student_name ?? '' });
    setRejectReason('');
  };

  const onConfirmReject = async () => {
    if (!rejectModal) return;
    setRejectLoading(true);
    try {
      const payload = rejectReason.trim() ? { rejection_reason: rejectReason.trim() } : {};
      await staffApi.rejectRequest(rejectModal.id, payload);
      staffToast.warning('Request rejected', `${rejectModal.student_name}'s record request has been rejected.`);
      setPendingRequests((prev) => prev.filter((r) => r.id !== rejectModal.id));
      setRejectModal(null);
      window.dispatchEvent(new Event('staff:dashboard-refresh'));
    } catch (err) {
      const parsed = parseApiError(err);
      staffToast.error('Reject failed', parsed.message || 'Request failed.');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleApprove = (id) => {
    const row = pendingRequests.find((r) => r.id === id);
    const now = new Date();
    const initialDate = toDateInput(now);
    setApproveModal(row || null);
    setApproveMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setAppointmentDate(initialDate);
    setAppointmentTime('');
    setSlotsPayload({ month: '', time_slots: DEFAULT_TIME_SLOTS, taken_by_date: {} });
  };

  const closeApproveModal = () => {
    if (approveLoading) return;
    setApproveModal(null);
  };

  const onConfirmApprove = async () => {
    if (!approveModal || !appointmentDate || !appointmentTime) {
      staffToast.error('Missing schedule', 'Please pick appointment date and time before approving.');
      return;
    }
    setApproveLoading(true);
    try {
      await staffApi.approveRequest(approveModal.id, {
        appointment_at: toIsoAppointment(appointmentDate, appointmentTime),
      });
      setPendingRequests((prev) => prev.filter((r) => r.id !== approveModal.id));
      setApproveModal(null);
      window.dispatchEvent(new Event('staff:dashboard-refresh'));
      staffToast.success('Request approved', `${approveModal.student_name}'s request is approved with a schedule.`);
    } catch (err) {
      const parsed = parseApiError(err);
      staffToast.error('Approve failed', parsed.message || 'Could not approve this request.');
    } finally {
      setApproveLoading(false);
    }
  };

  const onDownloadApprovalSlip = async (requestId) => {
    try {
      const response = await staffApi.downloadApprovalSlip(requestId);
      saveBlob(response, `request_approval_slip_${requestId}.pdf`);
      staffToast.success('PDF downloaded', 'Approval slip has been downloaded.');
    } catch (err) {
      const parsed = parseApiError(err);
      staffToast.error('Download failed', parsed.message || 'Could not download approval slip.');
    }
  };

  const togglePendingSort = (key) => {
    if (key === pendingSortKey) setPendingSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setPendingSortKey(key); setPendingSortDir('desc'); }
  };
  const toggleApprovedSort = (key) => {
    if (key === approvedSortKey) setApprovedSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setApprovedSortKey(key); setApprovedSortDir('desc'); }
  };
  const toggleRejectedSort = (key) => {
    if (key === rejectedSortKey) setRejectedSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setRejectedSortKey(key); setRejectedSortDir('desc'); }
  };

  const SortableTh = ({ label, sortKey, currentSortKey, currentSortDir, onToggle }) => (
    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-tmcc/30 rounded"
        onClick={() => onToggle(sortKey)}
      >
        {label}
        {currentSortKey === sortKey ? (
          currentSortDir === 'asc' ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 inline-block opacity-40"><FiChevronUp className="w-3 h-3" /></span>
        )}
      </button>
    </th>
  );

  const pendingFiltered = useMemo(() => {
    let list = pendingRequests.filter((r) => {
      const matchSearch = !pendingSearch || [r.student_name, r.record_type, r.purpose].some((v) =>
        String(v || '').toLowerCase().includes(pendingSearch.toLowerCase())
      );
      const matchType = !pendingFilterType || r.record_type === pendingFilterType;
      return matchSearch && matchType;
    });
    return sortData(list, pendingSortKey, pendingSortDir);
  }, [pendingRequests, pendingSearch, pendingFilterType, pendingSortKey, pendingSortDir]);

  const approvedSorted = useMemo(
    () => sortData(approvedRequests, approvedSortKey, approvedSortDir),
    [approvedRequests, approvedSortKey, approvedSortDir]
  );

  const rejectedSorted = useMemo(
    () => sortData(rejectedRequests, rejectedSortKey, rejectedSortDir),
    [rejectedRequests, rejectedSortKey, rejectedSortDir]
  );

  const pendingPaginated = useMemo(() => {
    const start = (pendingPage - 1) * pendingEntries;
    return pendingFiltered.slice(start, start + pendingEntries);
  }, [pendingFiltered, pendingPage, pendingEntries]);

  const pendingRecordTypes = useMemo(() => [...new Set(pendingRequests.map((r) => r.record_type))], [pendingRequests]);
  const monthCells = useMemo(() => buildMonthCells(approveMonth), [approveMonth]);
  const selectedDateTaken = slotsPayload.taken_by_date?.[appointmentDate] || [];
  const selectedDateObj = appointmentDate ? new Date(`${appointmentDate}T00:00:00`) : null;
  const now = useMemo(() => new Date(), []);
  const isSelectedToday = selectedDateObj ? isSameDate(selectedDateObj, now) : false;
  const disabledPastSlots = useMemo(() => {
    if (!isSelectedToday) return new Set();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return new Set(
      (slotsPayload.time_slots || []).filter((slot) => {
        const [hours, minutes] = String(slot).split(':').map(Number);
        const slotMinutes = (hours * 60) + minutes;
        return slotMinutes <= currentMinutes;
      })
    );
  }, [isSelectedToday, now, slotsPayload.time_slots]);
  const fullyBookedDates = useMemo(() => {
    const slotsCount = slotsPayload.time_slots?.length || 0;
    return new Set(
      Object.entries(slotsPayload.taken_by_date || {})
        .filter(([, taken]) => Array.isArray(taken) && taken.length >= slotsCount && slotsCount > 0)
        .map(([date]) => date)
    );
  }, [slotsPayload]);

  const currentError = activeTab === 'requests' ? loadError : activeTab === 'approved' ? approvedLoadError : rejectedLoadError;

  useEffect(() => {
    if (!approveModal) return;
    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const month = monthKeyFromDate(approveMonth);
        const data = await staffApi.getAppointmentSlots({ month });
        setSlotsPayload({
          month: data?.month || month,
          time_slots: Array.isArray(data?.time_slots) && data.time_slots.length > 0 ? data.time_slots : DEFAULT_TIME_SLOTS,
          taken_by_date: data?.taken_by_date || {},
        });
      } catch {
        setSlotsPayload((prev) => ({ ...prev, month: monthKeyFromDate(approveMonth), time_slots: DEFAULT_TIME_SLOTS }));
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [approveModal, approveMonth]);

  useEffect(() => {
    if (!appointmentTime) return;
    if (disabledPastSlots.has(appointmentTime)) {
      setAppointmentTime('');
    }
  }, [appointmentTime, disabledPastSlots]);

  return (
    <>
      <section className="mb-6">
        <h2 className="m-0 text-2xl font-bold text-gray-800">Transcript Requests</h2>
        <p className="mt-1 m-0 text-gray-600 text-sm">Review and approve or reject Official Transcript of Record requests. View approved and rejected in the tabs below.</p>
      </section>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-tmcc text-tmcc'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {currentError && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {currentError}
        </div>
      )}

      <section className="bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        {activeTab === 'requests' && (
          <>
            <div className="p-6 border-b border-gray-100">
              <h3 className="mt-0 mb-4 text-lg font-semibold text-gray-800">Pending Transcript Requests</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Search..."
                    value={pendingSearch}
                    onChange={(e) => { setPendingSearch(e.target.value); setPendingPage(1); }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                    aria-label="Search pending requests"
                  />
                </div>
                <select
                  value={pendingFilterType}
                  onChange={(e) => { setPendingFilterType(e.target.value); setPendingPage(1); }}
                  className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                  aria-label="Filter by record type"
                >
                  <option value="">All record types</option>
                  {pendingRecordTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Show</span>
                  <select
                    value={pendingEntries}
                    onChange={(e) => { setPendingEntries(Number(e.target.value)); setPendingPage(1); }}
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
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">ID</th>
                    <SortableTh label="Student Name" sortKey="student_name" currentSortKey={pendingSortKey} currentSortDir={pendingSortDir} onToggle={togglePendingSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Student No.</th>
                    <SortableTh label="Document Type" sortKey="record_type" currentSortKey={pendingSortKey} currentSortDir={pendingSortDir} onToggle={togglePendingSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Details</th>
                    <SortableTh label="Purpose" sortKey="purpose" currentSortKey={pendingSortKey} currentSortDir={pendingSortDir} onToggle={togglePendingSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Copies</th>
                    <SortableTh label="Date Submitted" sortKey="requested_at" currentSortKey={pendingSortKey} currentSortDir={pendingSortDir} onToggle={togglePendingSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="py-8 px-4 text-center text-gray-500">Loading pending requests...</td></tr>
                  ) : pendingPaginated.length > 0 ? (
                    pendingPaginated.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="py-3 px-4 text-gray-500 text-xs font-mono">#{req.id}</td>
                        <td className="py-3 px-4 text-gray-800">{req.student_name}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.student?.student_number ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-700 capitalize text-xs">
                          {req.record_type.replace(/_/g, ' ')}
                          {req.award_name && <div className="text-[10px] text-blue-600 font-semibold mt-1">{req.award_name}</div>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {req.academic_year ? `AY ${req.academic_year}` : '—'}<br/>
                          {req.semester ? `Sem ${req.semester}` : ''}
                        </td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.purpose || '—'}</td>
                        <td className="py-3 px-4 text-gray-700 text-center text-xs">{req.copies ?? 1}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.requested_at}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-tmcc text-white hover:bg-tmcc-dark focus:ring-2 focus:ring-tmcc/30" onClick={() => handleApprove(req.id)}><FiCheck /> Approve</button>
                            <button type="button" className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-staff-red text-white hover:opacity-90 focus:ring-2 focus:ring-red-500/30" onClick={() => handleReject(req.id)}><FiX /> Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className="py-8 px-4 text-center text-gray-500 italic">No pending requests.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pendingFiltered.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500 flex items-center justify-between gap-2">
                <span>
                  Showing {((pendingPage - 1) * pendingEntries) + 1}–{Math.min(pendingPage * pendingEntries, pendingFiltered.length)} of {pendingFiltered.length} entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={pendingPage <= 1}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-xs">Page {pendingPage} of {Math.ceil(pendingFiltered.length / pendingEntries) || 1}</span>
                  <button
                    type="button"
                    onClick={() => setPendingPage((p) => Math.min(Math.ceil(pendingFiltered.length / pendingEntries), p + 1))}
                    disabled={pendingPage >= Math.ceil(pendingFiltered.length / pendingEntries)}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'approved' && (
          <>
            <div className="p-6 border-b border-gray-100">
              <h3 className="mt-0 mb-4 text-lg font-semibold text-gray-800">Approved Requests</h3>
              <p className="m-0 text-sm text-gray-600">Click column headers to sort ascending or descending.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <SortableTh label="Student Name" sortKey="student_name" currentSortKey={approvedSortKey} currentSortDir={approvedSortDir} onToggle={toggleApprovedSort} />
                    <SortableTh label="Record Type" sortKey="record_type" currentSortKey={approvedSortKey} currentSortDir={approvedSortDir} onToggle={toggleApprovedSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Details</th>
                    <SortableTh label="Purpose" sortKey="purpose" currentSortKey={approvedSortKey} currentSortDir={approvedSortDir} onToggle={toggleApprovedSort} />
                    <SortableTh label="Requested" sortKey="requested_at" currentSortKey={approvedSortKey} currentSortDir={approvedSortDir} onToggle={toggleApprovedSort} />
                    <SortableTh label="Processed" sortKey="processed_at" currentSortKey={approvedSortKey} currentSortDir={approvedSortDir} onToggle={toggleApprovedSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Schedule</th>
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedLoading ? (
                    <tr><td colSpan={7} className="py-8 px-4 text-center text-gray-500">Loading approved requests...</td></tr>
                  ) : approvedSorted.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 px-4 text-center text-gray-500 italic">No approved requests.</td></tr>
                  ) : (
                    approvedSorted.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="py-3 px-4 text-gray-800">{req.student_name}</td>
                        <td className="py-3 px-4 text-gray-700 capitalize text-xs">
                          {req.record_type.replace(/_/g, ' ')}
                          {req.award_name && <div className="text-[10px] text-blue-600 font-semibold mt-1">{req.award_name}</div>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {req.academic_year ? `AY ${req.academic_year}` : '—'}<br/>
                          {req.semester ? `Sem ${req.semester}` : ''}
                        </td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.purpose || '—'}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.requested_at}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.processed_at ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.appointment_at ?? '—'}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-gray-700 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-400"
                            onClick={() => onDownloadApprovalSlip(req.id)}
                          >
                            <FiDownload /> Download PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {approvedSorted.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                Showing {approvedSorted.length} approved request{approvedSorted.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {activeTab === 'rejected' && (
          <>
            <div className="p-6 border-b border-gray-100">
              <h3 className="mt-0 mb-4 text-lg font-semibold text-gray-800">Rejected Requests</h3>
              <p className="m-0 text-sm text-gray-600">Click column headers to sort ascending or descending.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <SortableTh label="Student Name" sortKey="student_name" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                    <SortableTh label="Record Type" sortKey="record_type" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">Details</th>
                    <SortableTh label="Purpose" sortKey="purpose" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                    <SortableTh label="Requested" sortKey="requested_at" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                    <SortableTh label="Processed" sortKey="processed_at" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                    <SortableTh label="Reason" sortKey="rejection_reason" currentSortKey={rejectedSortKey} currentSortDir={rejectedSortDir} onToggle={toggleRejectedSort} />
                  </tr>
                </thead>
                <tbody>
                  {rejectedLoading ? (
                    <tr><td colSpan={6} className="py-8 px-4 text-center text-gray-500">Loading rejected requests...</td></tr>
                  ) : rejectedSorted.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 px-4 text-center text-gray-500 italic">No rejected requests.</td></tr>
                  ) : (
                    rejectedSorted.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="py-3 px-4 text-gray-800">{req.student_name}</td>
                        <td className="py-3 px-4 text-gray-700 capitalize text-xs">
                          {req.record_type.replace(/_/g, ' ')}
                          {req.award_name && <div className="text-[10px] text-blue-600 font-semibold mt-1">{req.award_name}</div>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {req.academic_year ? `AY ${req.academic_year}` : '—'}<br/>
                          {req.semester ? `Sem ${req.semester}` : ''}
                        </td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.purpose || '—'}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.requested_at}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.processed_at ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{req.rejection_reason ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {rejectedSorted.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                Showing {rejectedSorted.length} rejected request{rejectedSorted.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </section>

      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100">
                <FiAlertTriangle className="w-5 h-5 text-red-600" />
              </span>
              <div>
                <h3 className="m-0 text-base font-semibold text-gray-900">Reject Request</h3>
                <p className="m-0 mt-0.5 text-sm text-gray-500">{rejectModal.student_name}</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="m-0 text-sm text-gray-700">
                This will reject the record request. Provide an optional reason for the student.
              </p>
              <div>
                <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Incomplete requirements, request already processed…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
                  disabled={rejectLoading}
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{rejectReason.length}/500</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setRejectModal(null)}
                disabled={rejectLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-70"
                onClick={onConfirmReject}
                disabled={rejectLoading}
              >
                {rejectLoading ? 'Rejecting…' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {approveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="m-0 text-lg font-semibold text-gray-900">Approve Request & Set Schedule</h3>
                <p className="m-0 mt-1 text-sm text-gray-600">{approveModal.student_name} - {approveModal.record_type}</p>
              </div>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeApproveModal}>Close</button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-sm hover:bg-gray-50"
                    onClick={() => setApproveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    Prev
                  </button>
                  <div className="font-medium text-gray-800">
                    {approveMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-sm hover:bg-gray-50"
                    onClick={() => setApproveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    Next
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs text-center mb-1">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="font-semibold text-gray-500 py-1">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-sm">
                  {monthCells.map((day) => {
                    const key = toDateInput(day);
                    const inMonth = day.getMonth() === approveMonth.getMonth();
                    const selected = key === appointmentDate;
                    const booked = fullyBookedDates.has(key);
                    return (
                      <button
                        type="button"
                        key={key}
                        disabled={!inMonth}
                        onClick={() => setAppointmentDate(key)}
                        className={`py-2 rounded border text-center ${
                          !inMonth ? 'opacity-35 cursor-not-allowed' : selected
                            ? 'bg-tmcc text-white border-tmcc'
                            : booked ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 mb-0 text-xs text-gray-500">
                  Red dates are fully booked based on taken time slots.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="m-0 text-base font-semibold text-gray-800">Taken Slots</h4>
                {slotsLoading ? (
                  <p className="text-sm text-gray-500 mt-2">Loading availability...</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDateTaken.length > 0 ? selectedDateTaken.map((slot) => (
                      <span key={slot} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 border border-red-200">{slot}</span>
                    )) : (
                      <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">No taken slots on selected date</span>
                    )}
                  </div>
                )}
                <div className="mt-5">
                  <h4 className="m-0 text-base font-semibold text-gray-800">Pick Date and Time</h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                    />
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                    >
                      <option value="">Select time</option>
                      {slotsPayload.time_slots.map((slot) => {
                        const taken = selectedDateTaken.includes(slot);
                        const past = disabledPastSlots.has(slot);
                        return (
                          <option key={slot} value={slot} disabled={taken || past}>
                            {slot}{taken ? ' (taken)' : past ? ' (past)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {isSelectedToday && (
                    <p className="mt-2 mb-0 text-xs text-amber-700">
                      Past time slots for today are automatically disabled.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 border rounded-lg text-sm" onClick={closeApproveModal} disabled={approveLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-70"
                onClick={onConfirmApprove}
                disabled={approveLoading || !appointmentDate || !appointmentTime}
              >
                {approveLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffPendingRequestsPage;
