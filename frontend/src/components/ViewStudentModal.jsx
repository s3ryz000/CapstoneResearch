import React, { useEffect, useCallback, useRef } from 'react';
import { FiX, FiUser, FiMail, FiAward, FiEdit2, FiArchive } from 'react-icons/fi';
const ViewStudentModal = ({ isOpen, onClose, student, studentId, onFetchStudent, onEdit }) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement.current?.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-student-modal-title"
      aria-describedby="view-student-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      ref={modalRef}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <ViewStudentModalContent student={student} studentId={studentId} onFetchStudent={onFetchStudent} onClose={onClose} onEdit={onEdit} />
      </div>
    </div>
  );
};

/**
 * Inner content — handles loading, error, and display.
 */
const ViewStudentModalContent = ({ student, studentId, onFetchStudent, onClose, onEdit }) => {
  const [fetchedStudent, setFetchedStudent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!student && studentId && onFetchStudent) {
      setLoading(true);
      setError(null);
      onFetchStudent(studentId)
        .then((data) => {
          setFetchedStudent(data?.student ?? data);
          setError(null);
        })
        .catch((err) => {
          setError(err?.message ?? 'Failed to load student details.');
          setFetchedStudent(null);
        })
        .finally(() => setLoading(false));
    } else {
      setFetchedStudent(null);
      setLoading(false);
      setError(null);
    }
  }, [student, studentId, onFetchStudent]);

  const displayStudent = student ?? fetchedStudent;

  const formatDate = (val) => {
    if (!val) return '—';
    const d = typeof val === 'string' ? new Date(val) : val;
    return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatGPA = (val) => {
    if (val == null || val === '') return '—';
    const n = parseFloat(val);
    return isNaN(n) ? val : n.toFixed(2);
  };
  console.log(displayStudent);
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 id="view-student-modal-title" className="m-0 text-lg font-bold text-gray-800">
          Student Record Details
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-tmcc/30 transition-colors"
          aria-label="Close modal"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div id="view-student-modal-desc" className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-tmcc border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Loading student details...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="py-6 px-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

          {displayStudent && !loading && (
            
            <div className="space-y-6">
              {displayStudent.archive_records  && (
              <InfoSection
                title="Archive Information"
                icon={FiArchive}
                items={[
                  { label: 'Record Type', value: displayStudent.archive_records.record_type ?? '—' },
                  { label: 'Cabinet No', value: displayStudent.archive_records.cabinet_no ?? '—' },
                  { label: 'Shelf No', value: displayStudent.archive_records.shelf_no ?? '—' },
                  { label: 'Folder Code', value: displayStudent.archive_records.folder_code ?? '—' },
                  { label: 'Document Status', value: displayStudent.archive_records.document_status ?? '—' },
                ]}
              />
            )}
            <InfoSection
              title="Personal Information"
              icon={FiUser}
              items={[
                { label: 'Student Number', value: displayStudent.student_number ?? displayStudent.student_id ?? '—' },
                {
                  label: 'Full Name',
                  value:
                    displayStudent.first_name && displayStudent.last_name
                      ? `${displayStudent.first_name} ${displayStudent.last_name}`.trim()
                      : displayStudent.name ?? '—',
                },
                { label: 'Date of Birth', value: formatDate(displayStudent.date_of_birth) },
              ]}
            />

            <InfoSection
              title="Contact Information"
              icon={FiMail}
              items={[
                { label: 'Email', value: displayStudent.email ?? '—' },
                { label: 'Contact Number', value: displayStudent.contact_number ?? '—' },
                { label: 'Address', value: displayStudent.address ?? '—' },
              ]}
            />

            <InfoSection
              title="Enrollment Information"
              icon={FiAward}
              items={[
                { label: 'Enrollment Date', value: formatDate(displayStudent.enrollment_date) },
                { label: 'Graduation Date', value: formatDate(displayStudent.graduation_date) },
                { label: 'Overall GWA (Computed)', value: formatGPA(displayStudent.GPA) },
                { label: 'Program', value: displayStudent.program?.name || displayStudent.program?.code || displayStudent.course || '—' },
                ...(displayStudent.status ? [{ label: 'Status', value: displayStudent.status }] : []),
              ]}
            />
          </div>
        )}

        {!displayStudent && !loading && !error && (
          <p className="py-8 text-center text-gray-500">No student data to display.</p>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-end gap-3">
          {onEdit && displayStudent && (
            <button
              type="button"
              onClick={() => onEdit(displayStudent)}
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
            >
              <FiEdit2 /> Edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * Reusable info section with icon and label-value rows.
 */
const InfoSection = ({ title, icon: Icon, items }) => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-tmcc/10 text-tmcc">
        <Icon className="w-5 h-5" />
      </span>
      <h3 className="m-0 text-base font-semibold text-gray-800">{title}</h3>
    </div>
    <dl className="divide-y divide-gray-100">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3">
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider shrink-0 sm:w-36">{label}</dt>
          <dd className="m-0 text-sm text-gray-800 font-medium">
            {label === 'Status' && value !== '—' ? (
              <span className="inline-block py-1 px-3 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                {value}
              </span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

export default ViewStudentModal;
