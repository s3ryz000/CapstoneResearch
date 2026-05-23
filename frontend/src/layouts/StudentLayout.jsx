import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FiKey,
  FiLogOut,
  FiAlertTriangle,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { studentApi } from '../lib/api/studentApi';
import ChangePasswordModal from '../components/student/ChangePasswordModal';

const StudentLayout = () => {
  const { logout, logoutMutation } = useAuth();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProfileLoading(true);
    setProfileError(null);
    studentApi.getProfile()
      .then((data) => setProfile(data))
      .catch(() => {
        setProfileError('Failed to load profile.');
        setProfile(null);
      })
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    const onSettingsUpdated = () => {
      studentApi.getProfile()
        .then((data) => setProfile(data))
        .catch(() => {});
    };
    window.addEventListener('system-settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('system-settings-updated', onSettingsUpdated);
  }, []);

  const handleSignOut = () => logout();
  const handleChangePassword = () => setChangePasswordOpen(true);

  const student = profile?.student;
  const programMapping = profile?.program_mapping;
  const academicYear = profile?.academic_year || '';
  const semester = profile?.semester || '';
  const institutionName = profile?.institution_name || 'Trece Martires City College';
  const programName = profile?.program_mapping?.program?.name || student?.program_mapping?.program?.code || '';
  const fullName = student
    ? `${(student.last_name || '').toUpperCase()}, ${(student.first_name || '').toUpperCase()}`
    : '—';

  const isRequestPage = location.pathname === '/dashboard/request' || location.pathname === '/request';

  if (profileLoading && !profile) {
    return (
      <div className="sd-loading">
        <img src="/transparent-bg-logo.png" alt="TMCC" className="sd-loading-logo" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <div className="sd-page-container">
        {/* ========== HEADER ========== */}
        <header className="sd-header">
          <div className="sd-header-inner">
            <div className="sd-brand">
              <img src="/logo.png" alt="TMCC" className="sd-logo" onError={(e) => { e.target.style.display = 'none'; }} />
              <h1 className="sd-college-name">Trece Martires City College </h1>
            </div>
            <div className="sd-header-right">
              <div className="sd-datetime">
                <span className="sd-date">{currentDate}</span>
                <span className="sd-time">{currentTime}</span>
              </div>
              <button type="button" className="sd-link-btn" onClick={handleChangePassword} aria-label="Change Password">
                <FiKey className="sd-icon" />
                Change Password
              </button>
              <button
                type="button"
                className="sd-link-btn sd-signout"
                onClick={handleSignOut}
                disabled={logoutMutation.isPending}
                aria-label="Sign out"
              >
                <FiLogOut className="sd-icon" />
                {logoutMutation.isPending ? 'Signing out...' : 'Sign-out'}
              </button>
            </div>
          </div>
        </header>

        {profileError && (
          <div className="mx-4 mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {profileError}
          </div>
        )}

        {/* ========== PROFILE HERO ========== */}
        <section className="sd-profile-hero">
          <div className="sd-profile-bg" aria-hidden="true" />
          <div className="sd-profile-inner">
            <img src="/logo.png" alt="" className="sd-profile-photo" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="sd-profile-info">
              <div className="bg-white/60 px-5 w-fit">
                <h2 className="sd-profile-name">{fullName}</h2>
                <ul className="sd-academic-list">
                  <li>{semester} {academicYear}</li>
                  <li>{institutionName} {}</li>
                  {programName && <li>{programName}</li>}
                  <li className="sd-status-enrolled !text-green-900">ENROLLED </li>
                  {profile?.academic_summary && (
                    <>
                      <li className="font-semibold text-emerald-800">
                        Overall GWA: {profile.academic_summary.overall_gwa != null ? profile.academic_summary.overall_gwa.toFixed(2) : '—'} (Computed)
                      </li>
                      {profile.academic_summary.latin_honors?.honor && (
                        <li className="font-semibold text-amber-800">
                          Standing: {profile.academic_summary.latin_honors.honor}
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========== ADVISORY + REGISTRAR SECTION ========== */}
        <section className="sd-top-section">
          <div className="sd-advisory-box">
            <h3 className="sd-advisory-title">
              <FiAlertTriangle className="sd-advisory-icon" />
              Advisory
            </h3>
            <p className="sd-advisory-text">
              TMCC students are reminded to use their <strong>official student portal accounts</strong> for the Automated Student Records Management System (ASRMS). Do not share your password with anyone. For record requests and verification, coordinate with the <strong>Registrar&apos;s Office</strong>. This system supports faster processing of academic documents as stated in the ASRMS capstone project.
            </p>
          </div>
          <div className="sd-office-box">
            <h3 className="sd-office-title">Registrar&apos;s Office</h3>
            <ul className="sd-office-list">
              <li>Policies on Shifters and Transferees</li>
              <li>Student Records Management – ASRMS User Guide AY 2025-2026</li>
            </ul>
          </div>
        </section>

        {/* ========== MAIN NAV (TABS) ========== */}
        <nav className="sd-main-nav">
          <Link
            to="/dashboard"
            className={`sd-main-nav-item ${!isRequestPage ? 'active' : ''}`}
          >
            Home
          </Link>
        
        </nav>

        {/* ========== TAB CONTENT ========== */}
        <Outlet />

        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      </div>
    </div>
  );
};

export default StudentLayout;
