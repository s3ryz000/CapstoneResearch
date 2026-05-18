import React, { useEffect, useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { FiSearch, FiX, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { studentApi } from '../../lib/api/studentApi';

const semOrder = (s) => (typeof s === 'number' ? s : parseInt(String(s)) || 0);

const ViewCopyOfGradesModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleRequestRecord = () => {
    onClose();
    navigate('/dashboard/request');
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterAY, setFilterAY] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setFilterAY('');
    setFilterSem('');
    setSort('newest');
    setLoading(true);
    setError(null);
    studentApi
      .getGrades()
      .then(setData)
      .catch((err) => setError(err?.parsedApiError?.message || 'Failed to load grades.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const grades = useMemo(() => data?.grades ?? [], [data]);

  const ayOptions = useMemo(
    () => [...new Set(grades.map((g) => g.academic_year).filter(Boolean))].sort().reverse(),
    [grades],
  );
  const semOptions = useMemo(
    () =>
      [...new Set(grades.map((g) => g.semester).filter(Boolean))].sort(
        (a, b) => semOrder(a) - semOrder(b),
      ),
    [grades],
  );

  const displayed = useMemo(() => {
    let list = grades;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          (g.subject?.code ?? '').toLowerCase().includes(q) ||
          (g.subject?.title ?? '').toLowerCase().includes(q),
      );
    }
    if (filterAY) list = list.filter((g) => String(g.academic_year) === filterAY);
    if (filterSem) list = list.filter((g) => String(g.semester) === filterSem);

    return [...list].sort((a, b) => {
      const ayA = String(a.academic_year ?? '');
      const ayB = String(b.academic_year ?? '');
      const ayCmp = sort === 'oldest' ? ayA.localeCompare(ayB) : ayB.localeCompare(ayA);
      if (ayCmp !== 0) return ayCmp;
      return sort === 'oldest'
        ? semOrder(a.semester) - semOrder(b.semester)
        : semOrder(b.semester) - semOrder(a.semester);
    });
  }, [grades, search, filterAY, filterSem, sort]);

  const hasFilters = search.trim() || filterAY || filterSem || sort !== 'newest';

  const clearFilters = () => {
    setSearch('');
    setFilterAY('');
    setFilterSem('');
    setSort('newest');
  };

  const selCls =
    'text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-tmcc focus:border-tmcc';

  const semLabel = (s) => {
    const n = semOrder(s);
    if (n === 1) return '1st Sem';
    if (n === 2) return '2nd Sem';
    return `Sem ${s}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Copy of Grades" maxWidth="max-w-2xl">
      <div className="flex flex-col h-full">
        {!loading && !error && data && grades.length > 0 && (
          <div className="shrink-0 px-6 pt-3 pb-3 border-b border-gray-100 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search subject name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-tmcc focus:border-tmcc"
                />
              </div>
              <select
                value={filterAY}
                onChange={(e) => setFilterAY(e.target.value)}
                className={selCls}
              >
                <option value="">All Years</option>
                {ayOptions.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
              <select
                value={filterSem}
                onChange={(e) => setFilterSem(e.target.value)}
                className={selCls}
              >
                <option value="">All Semesters</option>
                {semOptions.map((s) => (
                  <option key={s} value={String(s)}>{semLabel(s)}</option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className={selCls}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  <FiX className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {displayed.length === grades.length
                ? `${grades.length} grade${grades.length !== 1 ? 's' : ''}`
                : `${displayed.length} of ${grades.length} grades`}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-gray-600">Loading...</p>}
          {error && (
            <p className="text-red-600 mb-4" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && data && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                This is a copy of your grades on record. For official documents, use Request
                Academic Record.
              </p>
              {grades.length === 0 ? (
                <p className="text-gray-500 italic">No grades on record.</p>
              ) : displayed.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 italic">No grades match your search.</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 text-sm text-tmcc hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        Academic Year
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Semester</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Code</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Subject</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Grade</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((g) => (
                      <tr key={g.id} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-800">{g.academic_year}</td>
                        <td className="py-2 px-3 text-gray-800">{g.semester}</td>
                        <td className="py-2 px-3 text-gray-800">{g.subject?.code}</td>
                        <td className="py-2 px-3 text-gray-800">{g.subject?.title}</td>
                        <td className="py-2 px-3 text-gray-800 font-medium">
                          {g.grade_value ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-700">{g.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
          <button
            type="button"
            onClick={handleRequestRecord}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-tmcc rounded-lg hover:bg-tmcc-dark focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-tmcc transition-colors"
          >
            <FiFileText className="w-4 h-4" />
            Request Academic Record
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ViewCopyOfGradesModal;
