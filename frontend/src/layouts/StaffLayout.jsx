import React, { useState, useEffect, useCallback } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FiInbox,
  FiUsers,
  FiBarChart2,
  FiKey,
  FiLogOut,
  FiPackage,
  FiChevronRight,
  FiChevronDown,
  FiUser,
  FiGrid,
  FiCheckCircle,
  FiShield,
  FiClipboard,
  FiEdit2,
  FiSearch,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordModal from '../components/staff/ChangePasswordModal';
import { dashboardApi } from '../lib/api/dashboardApi';
import { useCurrentTermQuery } from '../hooks/useCurrentTermQuery';

const StaffLayout = () => {
  const { user, role, logout, logoutMutation } = useAuth();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [kpi, setKpi] = useState({
    pendingRequests: 0,
    processedToday: 0,
    studentsCount: 0,
    documentsReleased: 0,
  });

  const { data: term, isLoading: termLoading } = useCurrentTermQuery();

  const fetchKpis = useCallback(() => {
    dashboardApi.getDashboard().then((res) => {
      const k = res?.kpis || {};
      setKpi({
        pendingRequests: k.pending_requests ?? 0,
        processedToday: k.processed_today ?? 0,
        studentsCount: k.students_count ?? 0,
        documentsReleased: k.documents_released_today ?? 0,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [location.pathname, fetchKpis]);

  useEffect(() => {
    const onRefresh = () => fetchKpis();
    window.addEventListener('staff:dashboard-refresh', onRefresh);
    return () => window.removeEventListener('staff:dashboard-refresh', onRefresh);
  }, [fetchKpis]);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pathname = location.pathname;
  const isNewStudentPage = pathname === '/staff/students/new';

  const isRegistrarRoute =
    pathname.startsWith('/staff/students') || pathname.startsWith('/staff/view-records');
  const [registrarOpen, setRegistrarOpen] = useState(isRegistrarRoute);

  useEffect(() => {
    if (isRegistrarRoute) setRegistrarOpen(true);
  }, [isRegistrarRoute, pathname]);

  const navItemsBeforeRegistrar = [
    { id: 'dashboard', label: 'Dashboard', icon: FiGrid, path: '/staff' },
    { id: 'requests', label: 'Transcript Requests', icon: FiInbox, path: '/staff/requests' },
    { id: 'document-release', label: 'Document Release', icon: FiPackage, path: '/staff/document-release' },
  ];

  const registrarSubItems = [
    {
      id: 'students',
      label: 'Student Records',
      icon: FiEdit2,
      path: '/staff/students',
      isActive: (p) =>
        !isNewStudentPage && (p === '/staff/students' || p.startsWith('/staff/students/')),
    },
    {
      id: 'view-records',
      label: 'View Records',
      icon: FiSearch,
      path: '/staff/view-records',
      isActive: (p) => p.startsWith('/staff/view-records'),
    },
  ];

  const navItemsAfterRegistrar = [
    { id: 'reports', label: 'Reports', icon: FiBarChart2, path: '/staff/reports' },
  ];

  const renderNavLink = (item) => {
    const { id, label, icon: Icon, path } = item;
    const isActive =
      !isNewStudentPage &&
      (pathname === path ||
        (path === '/staff/students' && pathname.startsWith('/staff/students')) ||
        (path === '/staff/requests' && pathname === '/staff/requests') ||
        (path === '/staff/document-release' && pathname === '/staff/document-release'));
    return (
      <Link
        key={id}
        to={path}
        className={`flex items-center gap-3 w-full py-3 px-4 rounded-lg text-[0.95rem] text-left no-underline transition-colors ${
          isActive ? 'bg-white/25 text-white font-semibold' : 'text-white/95 hover:bg-white/15 hover:text-white'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="w-5 h-5 shrink-0" aria-hidden />
        <span className="flex-1 flex items-center gap-2">
          <span>{label}</span>
          {id === 'requests' && kpi.pendingRequests > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-white text-[#1ac76a] text-xs font-semibold">
              {kpi.pendingRequests}
            </span>
          )}
        </span>
        <FiChevronRight className="w-4 h-4 shrink-0 opacity-80" />
      </Link>
    );
  };

  const handleChangePassword = () => setChangePasswordOpen(true);

  const staffName = user?.name || user?.username || 'Registrar';

  return (
    <div className="flex min-h-screen bg-[#f4f6f8]">
      {/* Left sidebar - solid green (image style) */}
      <aside className="w-[260px] min-w-[260px] flex flex-col bg-[#1ac76a] text-white shadow-[2px_0_12px_rgba(0,0,0,0.08)]">
        <div className="px-5 py-6 border-b border-white/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="TMCC Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-sm font-bold text-tmcc">TMCC</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-base font-semibold tracking-wide truncate">TMCC</h1>
            <span className="text-xs opacity-90">Staff — ASRMS</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5" aria-label="Staff dashboard navigation">
          {navItemsBeforeRegistrar.map(renderNavLink)}

          <div className="mt-0.5">
            <button
              type="button"
              className={`flex items-center gap-3 w-full py-3 px-4 rounded-lg text-[0.95rem] text-left transition-colors text-white/95 hover:bg-white/15 hover:text-white ${
                isRegistrarRoute ? 'bg-white/20' : ''
              }`}
              onClick={() => setRegistrarOpen((o) => !o)}
              aria-expanded={registrarOpen}
              aria-controls="staff-registrar-submenu"
            >
              <FiClipboard className="w-5 h-5 shrink-0" aria-hidden />
              <span className="flex-1 font-medium">Registrar</span>
              {registrarOpen ? (
                <FiChevronDown className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              ) : (
                <FiChevronRight className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              )}
            </button>

            {registrarOpen && (
              <div
                id="staff-registrar-submenu"
                className="mt-2 mx-1 mb-1 rounded-[10px] bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
              >
                <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-wider text-slate-500 uppercase">
                  Student Records:
                </p>
                <ul className="m-0 p-0 list-none flex flex-col gap-1">
                  {registrarSubItems.map(({ id, label, icon: SubIcon, path, isActive: isSubActive }) => {
                    const active = isSubActive(pathname);
                    return (
                      <li key={id}>
                        <Link
                          to={path}
                          className={`flex items-center gap-2.5 py-2 px-2 rounded-md text-[0.9rem] no-underline transition-colors ${
                            active
                              ? 'text-[#1ac76a] font-semibold bg-green-50/80'
                              : 'text-gray-800 hover:bg-gray-50'
                          }`}
                          aria-current={active ? 'page' : undefined}
                        >
                          <SubIcon
                            className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#1ac76a]' : 'text-gray-600'}`}
                            aria-hidden
                          />
                          <span>{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {navItemsAfterRegistrar.map(renderNavLink)}
        </nav>

        <div className="p-4 pt-4 border-t border-white/15">
          <div className="text-xs mb-3 leading-snug text-white/90">
            <span className="block font-medium">{currentDate}</span>
            <span>{currentTime}</span>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center gap-2 py-2 px-3 w-full justify-start rounded-md text-sm bg-white/15 border border-white/25 text-white hover:bg-white/25 transition-colors"
              onClick={handleChangePassword}
              aria-label="Change Password"
            >
              <FiKey className="w-4 h-4" />
              Change Password
            </button>
            {role === 'admin' && (
              <Link
                to="/admin"
                className="flex items-center gap-2 py-2 px-3 w-full justify-start rounded-md text-sm bg-white/15 border border-white/25 text-white hover:bg-white/25 transition-colors no-underline"
              >
                <FiShield className="w-4 h-4" />
                Admin Dashboard
              </Link>
            )}
            <button
              type="button"
              className="flex items-center gap-2 py-2 px-3 w-full justify-start rounded-md text-sm bg-white/15 border border-white/25 text-white hover:bg-red-500/40 hover:border-red-500/50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={() => logout()}
              disabled={logoutMutation.isPending}
              aria-label="Sign out"
            >
              <FiLogOut className="w-4 h-4" />
              {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar (image style) */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full overflow-hidden">
              <span className="bg-staff-sy-yellow text-gray-900 px-3 py-1 text-sm font-medium">
                {termLoading ? '…' : (term?.academic_year ?? '—')}
              </span>
              <span className="bg-staff-sy-green text-white px-3 py-1 text-sm font-medium">
                {termLoading ? '…' : (term?.semester ?? '—')}
              </span>
            </span>
            <span className="text-sm text-gray-500 ml-1">Active S.Y.</span>
          </div>
          <div className="flex items-center gap-4">
            {kpi.pendingRequests > 0 && (
              <Link
                to="/staff/requests"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition-colors no-underline"
              >
                <FiInbox className="w-3 h-3" />
                <span>Pending: {kpi.pendingRequests}</span>
              </Link>
            )}
            <span className="text-sm font-medium text-gray-700">{staffName}</span>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <FiUser className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </header>

        <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="max-w-[1100px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-100 text-green-700">
                <FiCheckCircle className="w-6 h-6" />
              </span>
              <div>
                <p className="m-0 text-2xl font-bold text-gray-900">{kpi.processedToday}</p>
                <p className="m-0 text-xs font-medium text-gray-500 uppercase tracking-wider">Processed Today</p>
              </div>
            </div>
            <Link to="/staff/students" className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-tmcc/30 hover:bg-green-50/50 transition-colors no-underline text-gray-800">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-700">
                <FiUsers className="w-6 h-6" />
              </span>
              <div>
                <p className="m-0 text-2xl font-bold text-gray-900">{kpi.studentsCount}</p>
                <p className="m-0 text-xs font-medium text-gray-500 uppercase tracking-wider">Students</p>
              </div>
            </Link>
           
          </div>
        </div>

        <main className="flex-1 overflow-auto py-6 px-8">
          <div className="max-w-[1100px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
};

export default StaffLayout;
