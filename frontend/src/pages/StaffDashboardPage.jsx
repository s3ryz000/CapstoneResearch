import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiInbox, FiUsers, FiPackage, FiBarChart2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../lib/api/dashboardApi';

const StaffDashboardPage = () => {
  const { user } = useAuth();
  const staffName = user?.name || user?.username || 'Staff';
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    dashboardApi.getDashboard()
      .then((res) => {
        setKpis(res?.kpis || null);
      })
      .catch(() => {});
  }, []);

  const quickLinks = [
    { path: '/staff/students', label: 'Student Records', icon: FiUsers, description: 'View and manage student records' },
    { path: '/staff/profile-updates', label: 'Profile Updates', icon: FiInbox, description: 'Review student profile changes', count: kpis?.pending_profile_updates },
    { path: '/staff/reports', label: 'Reports', icon: FiBarChart2, description: 'View read-only reports' },
  ];

  return (
    <>
      <section className="mb-8">
        <h2 className="m-0 text-2xl font-bold text-gray-800">Staff Dashboard</h2>
        <p className="mt-2 m-0 text-gray-600">Welcome back, {staffName}.</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map(({ path, label, icon: Icon, description, count }) => (
          <Link
            key={path}
            to={path}
            className="flex flex-col gap-3 p-6 bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 no-underline text-gray-800 hover:border-tmcc/30 hover:shadow-[0_4px_18px_rgba(0,0,0,0.1)] transition-all relative"
          >
            {count !== undefined && count > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
            <Icon className="w-10 h-10 text-tmcc" aria-hidden />
            <div>
              <h3 className="m-0 text-base font-semibold text-gray-800">{label}</h3>
              <p className="mt-1 m-0 text-sm text-gray-500">{description}</p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
};

export default StaffDashboardPage;
