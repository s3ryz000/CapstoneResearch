import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiInfo,
  FiFileText,
  FiAward,
  FiAlertCircle,
  FiCheckCircle,
  FiPieChart,
  FiTrendingUp,
  FiBookOpen,
  FiLayers,
} from 'react-icons/fi';
import { studentApi } from '../lib/api/studentApi';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['studentProfile'],
    queryFn: studentApi.getProfile,
  });

  const { data: academicSummary } = useQuery({
    queryKey: ['studentAcademicSummary'],
    queryFn: studentApi.getAcademicSummary,
  });

  const academicYear = profile?.academic_year || '';
  const semester = profile?.semester || '';
  const student = profile?.student || null;

  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';
  const needsSisUpdate = student
    ? ![
      student.address,
      student.place_of_birth,
      student.sex,
      student.guardian_name,
      student.citizenship,
      student.elementary_school,
      student.elementary_year,
      student.high_school,
      student.high_school_year,
      student.previous_school,
      student.previous_course,
    ].every(hasValue)
    : false;

  const summaryData = academicSummary?.summary;
  const curriculumData = academicSummary?.curriculum;
  const notifications = academicSummary?.notifications || [];

  return (
    <>
      <section className="sd-content">
        <h2 className="sd-section-title sd-title-red" style={{ marginBottom: '1rem' }}>
          Student Dashboard
        </h2>

        {/* ========== NOTIFICATIONS / ALERTS ========== */}
        {notifications.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            {notifications.map((note, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-md flex items-start gap-3 border ${
                  note.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : note.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                {note.type === 'success' ? <FiAward className="mt-1 flex-shrink-0" /> : <FiAlertCircle className="mt-1 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium">{note.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== ACADEMIC SUMMARY CARDS ========== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-5 border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <FiTrendingUp /> <span className="text-sm font-medium uppercase tracking-wider">Overall GWA</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">
              {summaryData?.overall_gwa ? Number(summaryData.overall_gwa).toFixed(2) : '—'}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-5 border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <FiBookOpen /> <span className="text-sm font-medium uppercase tracking-wider">Curriculum Units</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">
              {curriculumData?.total_curriculum_units || 0}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5 border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <FiCheckCircle /> <span className="text-sm font-medium uppercase tracking-wider">Units Completed</span>
            </div>
            <div className="text-3xl font-bold text-green-600 mt-auto">
              {curriculumData?.completed_units || 0}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5 border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <FiPieChart /> <span className="text-sm font-medium uppercase tracking-wider">Units Left</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 mt-auto">
              {curriculumData?.units_left || 0}
            </div>
          </div>
        </div>

        {/* ========== ENROLLMENT SECTION ========== */}
        <div className="sd-enrollment-section mt-8">
          <h2 className="sd-section-title sd-title-red">Enrollment - {semester} {academicYear}</h2>
          <p className="sd-filter-hint">
            <FiInfo className="sd-info-icon" />
            Access your full curriculum roadmap, grades, and academic standing below.
          </p>

          <div className="sd-quick-links" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="sd-quick-link" 
              onClick={() => navigate('/dashboard/academic-records')}
              style={{ flex: 1, minWidth: '250px', justifyContent: 'center' }}
            >
              <span className="sd-quick-icon"><FiLayers /></span> Academic Records
            </button>
            <button 
              type="button" 
              className="sd-quick-link" 
              onClick={() => navigate('/dashboard/request')}
              style={{ flex: 1, minWidth: '250px', justifyContent: 'center' }}
            >
              <span className="sd-quick-icon"><FiFileText /></span> Request Documents and Awards
            </button>
          </div>
        </div>

        {/* ========== RECORD UPDATE (SIS/SIUF - student records) ========== */}
        <h2 className="sd-section-title sd-title-red mt-8">Record Update</h2>
        <div className="sd-cards-row">
          <button
            type="button"
            className="sd-feature-card"
            style={{ textAlign: 'left', position: 'relative' }}
            onClick={() => navigate('/dashboard/sis')}
          >
            {needsSisUpdate && (
              <span
                aria-label="SIS not yet updated"
                title="SIS not yet updated"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: '#ef4444',
                  boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
                }}
              />
            )}
            <span className="sd-card-icon"><FiFileText /></span>
            <div>
              <strong>Student Information Sheet (SIS) and Student Information Updating Form (SIUF)</strong>
              <br />
              <small>Update your student records for the Registrar</small>
            </div>
          </button>
        </div>

        {/* ========== TRUNKLINES + LOCAL NUMBERS ========== */}
        <div className="sd-bottom-panels mt-8">
          <div className="sd-panel sd-panel-trunklines">
            <h3 className="sd-panel-title">Trunklines</h3>
            <div className="sd-trunkline-table">
              <div className="sd-trunkline-row"><strong>TRECE MARTIRES CITY COLLEGE</strong><span>(046) 419-XXXX</span></div>
              <div className="sd-trunkline-row"><strong>REGISTRAR&apos;S OFFICE</strong><span>(046) 419-XXXX local XXXX</span></div>
            </div>
            <h3 className="sd-panel-title">Local Numbers and Emails</h3>
            <div className="sd-tabs-row">
              <button type="button" className="sd-tab active">Registrar</button>
            </div>
            <div className="sd-email-table">
              <div className="sd-trunkline-row"><strong>Registrar</strong><span>registrar@tmcc.edu.ph</span></div>
            </div>
          </div>
          <div className="sd-panel sd-panel-logos">
            <div className="sd-logo-placeholder">TMCC</div>
            <div className="sd-logo-placeholder small">CHED</div>
            <div className="sd-logo-placeholder small">Partner</div>
          </div>
        </div>
      </section>
    </>
  );
};

export default StudentDashboard;
