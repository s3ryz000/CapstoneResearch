import React from 'react';
import { createBrowserRouter, Outlet, useLocation, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sileo';
import Navbar from '../components/Navbar';
import Home from '../pages/Home';
import Login from '../pages/Login';
import StudentDashboard from '../pages/StudentDashboard';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUserManagementPage from '../pages/admin/AdminUserManagementPage';
import AdminPendingRequestsPage from '../pages/admin/AdminPendingRequestsPage';
import AdminStudentRecordsPage from '../pages/admin/AdminStudentRecordsPage';
import AdminNewStudentPage from '../pages/admin/AdminNewStudentPage';
import AdminEditStudentPage from '../pages/admin/AdminEditStudentPage';
import AdminDocumentReleasePage from '../pages/admin/AdminDocumentReleasePage';
import AdminReportsPage from '../pages/admin/AdminReportsPage';
import AdminSystemSettingsPage from '../pages/admin/AdminSystemSettingsPage';
import StaffLayout from '../layouts/StaffLayout';
import StaffDashboardPage from '../pages/StaffDashboardPage';
import StaffPendingRequestsPage from '../pages/StaffPendingRequestsPage';
import StaffStudentRecordsPage from '../pages/StaffStudentRecordsPage';
import StaffDocumentReleasePage from '../pages/StaffDocumentReleasePage';
import StaffReportsPage from '../pages/StaffReportsPage';
import StaffNewStudentPage from '../pages/StaffNewStudentPage';
import StaffEditStudentPage from '../pages/StaffEditStudentPage';
import ViewRecordsPage from '../pages/ViewRecordsPage';
import StudentLayout from '../layouts/StudentLayout';
import StudentRequestRecordPage from '../pages/StudentRequestRecordPage';
import StudentSISPage from '../pages/StudentSISPage';
import StudentAcademicRecordsPage from '../pages/StudentAcademicRecordsPage';
import { AuthProvider, useAuth, ROLE_ROUTES } from '../contexts/AuthContext';
import { queryClient } from '../lib/react-query/queryClient';
import AdminSystemLogsPage from '../pages/admin/AdminSystemLogsPage';

function RootLayout() {
  const location = useLocation();
  const isFullPage = location.pathname === '/';
  const isStudentArea = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
  const isStaffArea = location.pathname.startsWith('/staff');
  const isAdminArea = location.pathname.startsWith('/admin');

  return (
    <>
      <Toaster position="top-right" theme="light" />
      {!isFullPage && !isStudentArea && !isStaffArea && !isAdminArea && <Navbar />}
      {isFullPage || isStudentArea || isStaffArea || isAdminArea ? (
        <Outlet />
      ) : (
        <div className="container">
          <Outlet />
        </div>
      )}
    </>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_ROUTES[role] || '/dashboard'} replace />;
  }

  return children;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootLayout />
        </AuthProvider>
      </QueryClientProvider>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['student', 'admin', 'staff']}>
            <StudentLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <StudentDashboard /> },
          { path: 'academic-records', element: <StudentAcademicRecordsPage /> },
          { path: 'request', element: <StudentRequestRecordPage /> },
          { path: 'sis', element: <StudentSISPage /> },
        ],
      },
      {
        path: 'staff',
        element: (
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <StaffLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <StaffDashboardPage /> },
          { path: 'requests', element: <StaffPendingRequestsPage /> },
          { path: 'students', element: <StaffStudentRecordsPage /> },
          { path: 'view-records', element: <ViewRecordsPage /> },
          { path: 'students/new', element: <StaffNewStudentPage /> },
          { path: 'students/:id/edit', element: <StaffEditStudentPage /> },
          { path: 'document-release', element: <StaffDocumentReleasePage /> },
          { path: 'reports', element: <StaffReportsPage /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'users', element: <AdminUserManagementPage /> },
          // { path: 'requests', element: <AdminPendingRequestsPage /> },
          // { path: 'students', element: <AdminStudentRecordsPage /> },
          // { path: 'view-records', element: <ViewRecordsPage /> },
          // { path: 'students/new', element: <AdminNewStudentPage /> },
          // { path: 'students/:id/edit', element: <AdminEditStudentPage /> },
          // { path: 'document-release', element: <AdminDocumentReleasePage /> },
          { path: 'reports', element: <AdminReportsPage /> },
          { path: 'settings', element: <AdminSystemSettingsPage /> },
          { path: 'logs', element: <AdminSystemLogsPage /> },
        ],
      },
      {
        path: 'request',
        element: <Navigate to="/dashboard/request" replace />,
      },
    ],
  },
]);

export default router;
