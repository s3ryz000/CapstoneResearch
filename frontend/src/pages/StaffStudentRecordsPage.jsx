import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FiUserPlus,
  FiEye,
  FiEdit2,
  FiSearch,
  FiChevronUp,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiArchive,
} from "react-icons/fi";
import ViewStudentModal from "../components/ViewStudentModal";
import { staffApi } from "../lib/api/staffApi";
import { parseApiError } from "../lib/api/errors";
import { queryKeys } from "../lib/react-query/queryKeys";
import ArchiveModal from "../components/ui/ArchiveModal";

const ENTRIES_OPTIONS = [5, 10, 25, 50];

const SEARCH_DEBOUNCE_MS = 400;

const mapStudentRow = (s) => ({
  ...s,
  id: s.student_id,
  name:
    [s.first_name, s.last_name].filter(Boolean).join(" ") ||
    s.user?.name ||
    "—",
  course: s.program?.code || s.program?.name || "—",
  status: "ENROLLED",
});

const StaffStudentRecordsPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [studentFilterCourse, setStudentFilterCourse] = useState("");
  const [studentSortKey, setStudentSortKey] = useState("name");
  const [studentSortDir, setStudentSortDir] = useState("asc");
  const [studentEntries, setStudentEntries] = useState(10);
  const [studentPage, setStudentPage] = useState(1);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [archivingStudent, setArchivingStudent] = useState(null);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setStudentPage(1);
  }, [
    debouncedSearch,
    studentSortKey,
    studentSortDir,
    studentFilterCourse,
    studentEntries,
  ]);

  const listFilters = useMemo(
    () => ({
      page: studentPage,
      perPage: studentEntries,
      search: debouncedSearch,
      sort: studentSortKey,
      dir: studentSortDir,
      program: studentFilterCourse,
    }),
    [
      studentPage,
      studentEntries,
      debouncedSearch,
      studentSortKey,
      studentSortDir,
      studentFilterCourse,
    ],
  );

  const {
    data: listPayload,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.staff.studentsList(listFilters),
    queryFn: () =>
      staffApi.getStudents({
        page: listFilters.page,
        per_page: listFilters.perPage,
        search: listFilters.search || undefined,
        sort: listFilters.sort,
        dir: listFilters.dir,
        program: listFilters.program || undefined,
      }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previousData) => previousData,
  });

  const students = useMemo(() => {
    const raw = listPayload?.data;
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapStudentRow);
  }, [listPayload]);

  const total = typeof listPayload?.total === "number" ? listPayload.total : 0;
  const lastPage =
    typeof listPayload?.last_page === "number" ? listPayload.last_page : 1;
  const from = typeof listPayload?.from === "number" ? listPayload.from : 0;
  const to = typeof listPayload?.to === "number" ? listPayload.to : 0;

  const loadError = isError
    ? parseApiError(error).message || "Failed to load students."
    : null;

  const { data: programsPayload } = useQuery({
    queryKey: queryKeys.staff.programs(),
    queryFn: () => staffApi.getPrograms(),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  const programOptions = useMemo(() => {
    const list = programsPayload?.programs;
    return Array.isArray(list) ? list : [];
  }, [programsPayload]);

  const toggleSort = (key) => {
    if (key === studentSortKey)
      setStudentSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setStudentSortKey(key);
      setStudentSortDir("asc");
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
        {studentSortKey === sortKey ? (
          studentSortDir === "asc" ? (
            <FiChevronUp className="w-4 h-4" />
          ) : (
            <FiChevronDown className="w-4 h-4" />
          )
        ) : (
          <span className="w-4 h-4 inline-block opacity-40">
            <FiChevronUp className="w-3 h-3" />
          </span>
        )}
      </button>
    </th>
  );

  const goPrev = useCallback(
    () => setStudentPage((p) => Math.max(1, p - 1)),
    [],
  );
  const goNext = useCallback(
    () => setStudentPage((p) => Math.min(lastPage, p + 1)),
    [lastPage],
  );

  const tableLoading = isLoading && !listPayload;

  return (
    <>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-2xl font-bold text-gray-800">
          Student Records
        </h2>
      </section>
      {loadError && (
        <div
          className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
          role="alert"
        >
          {loadError}
        </div>
      )}
      <section className=" p-5 bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="p-6 pt-0 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search by name or student ID..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setStudentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                aria-label="Search students"
              />
            </div>
            <select
              value={studentFilterCourse}
              onChange={(e) => {
                setStudentFilterCourse(e.target.value);
                setStudentPage(1);
              }}
              className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
              aria-label="Filter by course"
            >
              <option value="">All courses</option>
              {programOptions.map((p) => {
                const value = p.code || p.name;
                const label =
                  [p.code, p.name].filter(Boolean).join(" — ") || value;
                return (
                  <option key={p.id} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select
                value={studentEntries}
                onChange={(e) => {
                  setStudentEntries(Number(e.target.value));
                  setStudentPage(1);
                }}
                className="py-1.5 px-2 border border-gray-300 rounded text-sm"
              >
                {ENTRIES_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
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
                <SortableTh label="Student ID" sortKey="student_id" />
                <SortableTh label="Name" sortKey="name" />
                <SortableTh label="Course" sortKey="course" />
                <SortableTh label="Status" sortKey="status" />
                <th className="py-3 px-4 text-left border-b-2 border-gray-200 bg-gray-100 font-semibold text-gray-700">
                  Actions 
                </th>
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-gray-500"
                  >
                    Loading students...
                  </td>
                </tr>
              ) : students.length > 0 ? (
                students.map((student) => (
                  <tr
                    key={student?.student_id}
                    className="border-b border-gray-100 hover:bg-gray-50/80"
                  >
                    <td className="py-3 px-4 text-gray-800">
                      {student?.student_number ?? student?.student_id}
                    </td>
                    <td className="py-3 px-4 text-gray-800">{student?.name}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {student?.course}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block py-1 px-3 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {student?.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingStudent(student)}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-tmcc text-white hover:bg-tmcc-dark focus:outline-none focus:ring-2 focus:ring-tmcc/30 transition-colors"
                          aria-label={`View details for ${student?.name}`}
                        >
                          <FiEye /> View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/staff/students/${student?.student_id}/edit`,
                              { state: { student } },
                            )
                          }
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
                          aria-label={`Edit ${student?.name}`}
                        >
                          <FiEdit2 /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchivingStudent(student)}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
                          aria-label={`Edit ${student?.name}`}
                        >
                          <FiArchive /> Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-gray-500 italic"
                  >
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <span>
              Showing {from} to {to} of {total} entries
              {isFetching && !tableLoading ? (
                <span className="ml-2 text-gray-400">(updating…)</span>
              ) : null}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={studentPage <= 1 || tableLoading}
                className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-gray-600">
                Page {listPayload?.current_page ?? studentPage} of {lastPage}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={studentPage >= lastPage || tableLoading}
                className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
      <ArchiveModal
        isOpen={!!archivingStudent}
        onClose={() => setArchivingStudent(null)}
        student={archivingStudent}
      />
      <ViewStudentModal
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        student={viewingStudent}
        studentId={viewingStudent?.student_id}
        onFetchStudent={(id) => staffApi.getStudentById(id)}
        onEdit={(s) => {
          setViewingStudent(null);
          navigate(`/staff/students/${s?.student_id ?? s.id}/edit`, {
            state: { student: s },
          });
        }}
      />
    </>
  );
};

export default StaffStudentRecordsPage;
