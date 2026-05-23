import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSearch, FiFilter } from 'react-icons/fi';
import { studentApi } from '../lib/api/studentApi';

const StudentAcademicRecordsPage = () => {
  const { data: academicSummary, isLoading, error } = useQuery({
    queryKey: ['studentAcademicSummary'],
    queryFn: studentApi.getAcademicSummary,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const roadmapData = academicSummary?.curriculum?.roadmap || [];

  const filteredRoadmap = useMemo(() => {
    return roadmapData.filter(item => {
      const matchSearch = 
        item.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.subject_description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchYear = yearFilter ? String(item.curriculum_year_level) === yearFilter : true;
      const matchSem = semesterFilter ? String(item.curriculum_semester) === semesterFilter : true;
      
      let matchStatus = true;
      if (statusFilter) {
        if (statusFilter === 'Completed') {
          matchStatus = item.status === 'Completed';
        } else if (statusFilter === 'Enrolled') {
          matchStatus = item.status === 'Currently Enrolled';
        } else if (statusFilter === 'Failed') {
          matchStatus = item.status === 'Failed - Retake Required';
        } else if (statusFilter === 'Blocked') {
          matchStatus = item.status.includes('Blocked');
        } else if (statusFilter === 'Eligible') {
          matchStatus = item.status === 'Eligible to Take' || item.status === 'Not Yet Taken';
        }
      }

      return matchSearch && matchYear && matchSem && matchStatus;
    });
  }, [roadmapData, searchTerm, yearFilter, semesterFilter, statusFilter]);

  const getStatusBadgeClass = (status) => {
    if (status === 'Completed') return 'bg-green-100 text-green-800';
    if (status === 'Currently Enrolled') return 'bg-blue-100 text-blue-800';
    if (status === 'Failed - Retake Required') return 'bg-red-100 text-red-800';
    if (status === 'Incomplete') return 'bg-orange-100 text-orange-800';
    if (status?.includes('Blocked')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-50 text-gray-600';
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading academic records...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Failed to load academic records.</div>;
  }

  return (
    <section className="sd-content">
      <h2 className="sd-section-title sd-title-red mb-6">Academic Records & Curriculum Roadmap</h2>
      
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search subject code or description..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <select
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>

            <select
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
            >
              <option value="">All Semesters</option>
              <option value="1">1st Semester</option>
              <option value="2">2nd Semester</option>
            </select>

            <select
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Enrolled">Currently Enrolled</option>
              <option value="Failed">Failed (Retake Required)</option>
              <option value="Blocked">Blocked (Missing Prerequisite)</option>
              <option value="Eligible">Eligible to Take / Not Taken</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Year/Sem</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Units</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Prerequisite</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoadmap.length > 0 ? (
                filteredRoadmap.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      Y{item.curriculum_year_level} S{item.curriculum_semester}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {item.subject_code}
                    </td>
                    <td className="px-6 py-4">
                      {item.subject_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {item.units}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {item.prerequisites || 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {item.grade ? Number(item.grade).toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No subjects match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default StudentAcademicRecordsPage;
