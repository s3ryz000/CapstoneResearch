import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiUserPlus,
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiPrinter,
} from "react-icons/fi";
import { adminToast } from "../../lib/notifications";
import { parseApiError } from "../../lib/api/errors";
import { adminApi } from "../../lib/api/adminApi";
import { queryKeys } from "../../lib/react-query/queryKeys";
import { useAdminUsersListQuery } from "../../hooks/useAdminUsersListQuery";
import {
  ADMIN_USERS_DEFAULT_PER_PAGE,
  ADMIN_USERS_SEARCH_DEBOUNCE_MS,
} from "../../features/admin/constants";
import useAdminViewSystemLogs from "../../hooks/useAdminViewSystemLogs";

const SORTABLE = ["name", "username", "role", "status"];

const AdminSystemLogsPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [entries, setEntries] = useState(ADMIN_USERS_DEFAULT_PER_PAGE);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      ADMIN_USERS_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterRole, entries, sortKey, sortDir]);

  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportSystemLogsPdf();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `AUDIT_LOG_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      adminToast.success("Export ready", "Audit log PDF downloaded.");
    } catch {
      adminToast.error("Export failed", "Could not generate audit log PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportSystemLogsPdf();
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, "_blank");
      if (!win) adminToast.warning("Pop-up blocked", "Allow pop-ups to print the audit log.");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      adminToast.error("Print failed", "Could not load audit log for printing.");
    } finally {
      setExporting(false);
    }
  };

  const listQuery = useAdminViewSystemLogs({ page, entries });
  const { data, isLoading, isFetching } = listQuery;

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const lastPage = data?.last_page ?? 1;
  const currentPage = data?.current_page ?? 1;
  const from = data?.from ?? 0;
  const to = data?.to ?? 0;

  const listInitialLoading = isLoading && !listQuery.data;
  const listUpdating = isFetching && !listInitialLoading;

  useEffect(() => {
    if (lastPage >= 1 && page > lastPage) {
      setPage(lastPage);
    }
  }, [lastPage, page]);

  const SortableTh = ({ label, sortKey: sk }) => (
    <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">
      {label}
      {sortKey === sk ? (
        sortDir === "asc" ? (
          <FiChevronUp className="w-4 h-4" />
        ) : (
          <FiChevronDown className="w-4 h-4" />
        )
      ) : (
        <span className="w-4 h-4 inline-block opacity-40">
          <FiChevronUp className="w-3 h-3" />
        </span>
      )}
    </th>
  );

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setPage((p) => Math.min(lastPage, p + 1)),
    [lastPage],
  );

  return (
    <>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-gray-800">System Logs</h2>
          <p className="mt-1 m-0 text-gray-600 text-sm">
            View and manage system logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={exporting}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FiPrinter className="w-4 h-4" />
            Print Audit Log
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-tmcc text-white text-sm font-medium hover:bg-tmcc-dark disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FiDownload className="w-4 h-4" />
            {exporting ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <SortableTh label="Log ID" sortKey="log_id" />
                <SortableTh label="Action" sortKey="action" />
                <SortableTh label="User ID" sortKey="user_id" />
                <SortableTh label="Role" sortKey="role" />
                <SortableTh label="Logged At" sortKey="created_at" />
              </tr>
            </thead>
            <tbody>
              {listInitialLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 px-4 text-center text-gray-500"
                  >
                    Loading logs…
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50/80"
                  >
                    <td className="py-3 px-4 text-gray-800">{u.log_id}</td>
                    <td className="py-3 px-4 text-gray-700">{u.action}</td>
                    <td className="py-3 px-4 text-gray-700">{u.user_id}</td>
                    <td className="py-3 px-4 text-gray-700">{u.role}</td>
                    <td className="py-3 px-4 text-gray-700">{u.created_at}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-gray-500 italic"
                  >
                    No logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500 flex flex-wrap items-center justify-between gap-3">
            <span>
              Showing {from || 0} to {to || 0} of {total} entries
              {listUpdating ? (
                <span className="ml-1 text-gray-400">(updating…)</span>
              ) : null}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={page <= 1 || listInitialLoading}
                className="inline-flex items-center gap-1 py-1.5 px-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="inline-flex items-center gap-1 py-1.5 px-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default AdminSystemLogsPage;
