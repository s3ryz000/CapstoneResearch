import React, { useEffect, useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { FiList, FiGrid, FiCheck, FiSearch, FiX } from 'react-icons/fi';
import { studentApi } from '../../lib/api/studentApi';

const VIEW_LIST = 'list';
const VIEW_TABLE = 'table';

const semOrder = (s) => (typeof s === 'number' ? s : parseInt(String(s)) || 0);

const GradesModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEW_LIST);
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
      if (sort === 'grade-asc') {
        return (parseFloat(a.grade_value ?? 99)) - (parseFloat(b.grade_value ?? 99));
      }
      if (sort === 'grade-desc') {
        return (parseFloat(b.grade_value ?? 0)) - (parseFloat(a.grade_value ?? 0));
      }
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
    <Modal isOpen={isOpen} onClose={onClose} title="Grades" maxWidth="max-w-3xl">
      <div className="flex flex-col h-full">
        {/* Controls — shown once data is loaded */}
        {!loading && !error && data && (
          <div className="shrink-0 px-6 pt-3 pb-3 border-b border-gray-100 space-y-2">
            {/* Row 1: search + filter dropdowns */}
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
                <option value="grade-asc">Best grade first</option>
                <option value="grade-desc">Lowest grade first</option>
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
            {/* Row 2: result count + view toggle */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {displayed.length === grades.length
                  ? `${grades.length} grade${grades.length !== 1 ? 's' : ''}`
                  : `${displayed.length} of ${grades.length} grades`}
              </span>
              {grades.length > 0 && (
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setView(VIEW_LIST)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === VIEW_LIST
                        ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <FiList className="w-3.5 h-3.5" /> List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(VIEW_TABLE)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === VIEW_TABLE
                        ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <FiGrid className="w-3.5 h-3.5" /> Table
                  </button>
                </div>
              )}
            </div>
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
              ) : view === VIEW_LIST ? (
                <ul className="space-y-0 divide-y divide-gray-100">
                  {displayed.map((g) => (
                    <li key={g.id} className="py-4 first:pt-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {[g.subject?.code, g.subject?.title].filter(Boolean).join(' - ')}
                            {g.subject?.units != null && (
                              <span className="font-normal text-gray-600">
                                {' '}
                                ({Number(g.subject.units)} unit
                                {g.subject.units !== 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {g.academic_year}
                            {g.semester ? ` · Sem ${g.semester}` : ''}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {g.instructor_name ?? '—'}
                          </p>
                          <p className="text-sm text-gray-800 mt-1 font-medium">
                            {g.grade_value ?? '—'}
                          </p>
                        </div>
                        <span className="shrink-0 text-emerald-600" aria-hidden="true">
                          <FiCheck className="w-5 h-5" strokeWidth={2.5} />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-3 font-semibold text-gray-700 whitespace-nowrap">
                          AY / Sem
                        </th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Code</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">
                          Description
                        </th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Units</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Grade</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">
                          Instructor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((g) => (
                        <tr key={g.id} className="border-b border-gray-100">
                          <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap text-xs">
                            {g.academic_year}
                            {g.semester ? ` S${g.semester}` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-gray-800">{g.subject?.code ?? '—'}</td>
                          <td className="py-2.5 px-3 text-gray-800">{g.subject?.title ?? '—'}</td>
                          <td className="py-2.5 px-3 text-gray-800">
                            {g.subject?.units != null ? Number(g.subject.units) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-800 font-medium">
                            {g.grade_value ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700 uppercase">
                            {g.instructor_name ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50/50">
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

export default GradesModal;
