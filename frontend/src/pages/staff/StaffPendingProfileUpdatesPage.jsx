import React, { useState, useEffect } from 'react';
import { staffApi } from '../../lib/api/staffApi';
import { staffToast } from '../../lib/notifications';
import { FiCheck, FiX, FiEye, FiDownload } from 'react-icons/fi';

const StaffPendingProfileUpdatesPage = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const data = await staffApi.getPendingProfileUpdates();
      // Filter out non-pending updates for the main list
      setUpdates(data.filter(u => u.status === 'pending'));
    } catch (err) {
      staffToast.error('Load failed', 'Failed to load pending profile updates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const handleApprove = async (id) => {
    setProcessing(true);
    try {
      await staffApi.approveProfileUpdate(id);
      staffToast.success('Approved', 'Profile update has been approved and applied.');
      setSelectedUpdate(null);
      fetchUpdates();
    } catch (err) {
      staffToast.error('Approval failed', err?.response?.data?.message || 'Failed to approve update.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id) => {
    setProcessing(true);
    try {
      await staffApi.rejectProfileUpdate(id, { rejection_reason: rejectionReason });
      staffToast.success('Rejected', 'Profile update has been rejected.');
      setSelectedUpdate(null);
      setRejectionReason('');
      fetchUpdates();
    } catch (err) {
      staffToast.error('Rejection failed', err?.response?.data?.message || 'Failed to reject update.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadDocument = async (id, originalName) => {
    try {
      const response = await staffApi.downloadProfileUpdateDocument(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName || `document_${id}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      staffToast.error('Download failed', 'Could not download the document.');
    }
  };

  if (loading && updates.length === 0) {
    return (
      <section className="sd-content">
        <h2 className="sd-section-title">Pending Profile Updates</h2>
        <p className="text-gray-600">Loading...</p>
      </section>
    );
  }

  return (
    <section className="sd-content relative">
      <h2 className="sd-section-title">Pending Profile Updates</h2>
      <p className="sd-filter-hint mb-6">Review student-submitted profile changes before officially applying them.</p>

      {updates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          No pending profile updates found.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student Name</th>
                <th className="px-4 py-3 font-medium">Student ID</th>
                <th className="px-4 py-3 font-medium">Changed Fields</th>
                <th className="px-4 py-3 font-medium">Submitted Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {updates.map((update) => {
                const s = update.student;
                const fullName = `${s.first_name} ${s.last_name}`.toUpperCase();
                const fields = update.changed_fields?.join(', ') || 'None';
                
                return (
                  <tr key={update.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-800 font-medium">{fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.student_number || s.student_id}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={fields}>{fields}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(update.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedUpdate(update)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md hover:bg-indigo-100"
                      >
                        <FiEye className="w-3.5 h-3.5" /> View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 m-0">Review Profile Changes</h3>
              <button onClick={() => setSelectedUpdate(null)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-500 m-0">Student</p>
                <p className="font-semibold text-gray-800">
                  {selectedUpdate.student?.first_name} {selectedUpdate.student?.last_name} ({selectedUpdate.student?.student_number})
                </p>
              </div>

              {selectedUpdate.supporting_document_path && (
                <div className="mb-5">
                  <p className="text-sm text-gray-500 m-0 mb-1">Supporting Document</p>
                  <div className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                    <span className="text-sm font-medium text-indigo-900 flex-1 truncate" title={selectedUpdate.supporting_document_original_name}>
                      {selectedUpdate.supporting_document_original_name || 'Document Attached'}
                    </span>
                    <button 
                      onClick={() => handleDownloadDocument(selectedUpdate.id, selectedUpdate.supporting_document_original_name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                    >
                      <FiDownload className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>
              )}

              <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">Fields to Update</h4>
              
              <div className="space-y-4">
                {(selectedUpdate.changed_fields || []).map(field => (
                  <div key={field} className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{field.replace('_', ' ')} (OLD)</p>
                      <p className="text-sm text-gray-700 break-words line-through decoration-red-400">
                        {selectedUpdate.old_values[field] || <span className="italic text-gray-400">Empty</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">NEW VALUE</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {selectedUpdate.new_values[field] || <span className="italic text-gray-400">Empty</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (Optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows="2"
                  placeholder="If rejecting, explain why..."
                ></textarea>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedUpdate(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedUpdate.id)}
                disabled={processing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-lg hover:bg-red-200"
              >
                <FiX className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleApprove(selectedUpdate.id)}
                disabled={processing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                <FiCheck className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default StaffPendingProfileUpdatesPage;
