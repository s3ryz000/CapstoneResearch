import React, { useState, useMemo } from 'react';
import { FiInfo, FiCheckCircle, FiClock, FiDownload, FiPlusCircle } from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { studentApi } from '../lib/api/studentApi';
import { parseApiError } from '../lib/api/errors';
import { studentToast } from '../lib/notifications';

const StudentRequestRecordPage = () => {
  const queryClient = useQueryClient();

  // Fetch Academic Summary for eligibility
  const { data: summaryPayload, isLoading: summaryLoading } = useQuery({
    queryKey: ['student', 'academicSummary'],
    queryFn: studentApi.getAcademicSummary,
  });

  // Fetch Existing Requests
  const { data: requestsPayload, isLoading: requestsLoading } = useQuery({
    queryKey: ['student', 'recordRequests'],
    queryFn: () => studentApi.getRecordRequests({ per_page: 100 }),
  });

  const [submittingId, setSubmittingId] = useState(null);

  const createRequestMutation = useMutation({
    mutationFn: studentApi.createRecordRequest,
    onSuccess: () => {
      queryClient.invalidateQueries(['student', 'recordRequests']);
      studentToast.success('Request Submitted', 'Your document request has been submitted to the Registrar.');
    },
    onError: (error) => {
      studentToast.error('Request Failed', parseApiError(error)?.message || 'Failed to submit request.');
    },
    onSettled: () => {
      setSubmittingId(null);
    }
  });

  const handleRequest = (docKey, recordType, ay, sem, awardName) => {
    setSubmittingId(docKey);
    createRequestMutation.mutate({
      record_type: recordType,
      academic_year: ay === 'All' || ay === 'Overall' ? null : ay,
      semester: sem === 'All' || sem === 'Graduation' ? null : sem,
      award_name: awardName,
      copies: 1,
    });
  };

  const handleDownloadTranscript = async (requestId) => {
    try {
      const response = await studentApi.downloadTranscript(requestId);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Official_Transcript_${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      studentToast.success('Downloaded', 'The transcript has been downloaded successfully.');
    } catch (err) {
      studentToast.error('Download Failed', parseApiError(err)?.message || 'Failed to download transcript.');
    }
  };

  const generateAwardPdf = (awardName, ay, sem) => {
    if (!summaryPayload?.student) return;
    const student = summaryPayload.student;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont('times', 'bold');
    doc.text('Trece Martires City College', 105, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    doc.text('Automated Student Records Management System', 105, 40, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('times', 'bold');
    doc.text('CERTIFICATE OF ELIGIBILITY', 105, 60, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    
    const studentName = student.first_name + ' ' + student.last_name;
    const studentId = student.student_number || student.student_id;
    const programName = student.program?.name || 'N/A';
    const computedGwa = summaryPayload?.summary?.overall_gwa || 'N/A';
    
    let text = `This certifies that ${studentName}, ${studentId}, from ${programName}, is eligible for ${awardName} for ${ay}`;
    if (sem && sem !== 'All' && sem !== 'Graduation') {
      text += ` ${sem}`;
    }
    text += `, based on computed academic records in the Automated Student Records Management System.`;

    const splitText = doc.splitTextToSize(text, 170);
    doc.text(splitText, 20, 80);

    doc.text(`Computed GWA: ${Number(computedGwa).toFixed(2)}`, 20, 120);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, 130);

    doc.save(`${awardName.replace(/\s+/g, '_')}_${studentId}.pdf`);
  };

  const requestsList = useMemo(() => {
    if (!requestsPayload?.data) return [];
    return Array.isArray(requestsPayload.data) ? requestsPayload.data : [];
  }, [requestsPayload]);

  const documentsList = useMemo(() => {
    if (!summaryPayload) return [];
    const list = [];
    
    const pushDoc = (ay, sem, type, name, recordType, awardName = null) => {
      const matchAy = ay === 'All' || ay === 'Overall' ? null : ay;
      const matchSem = sem === 'All' || sem === 'Graduation' ? null : sem;

      // Find the latest request for this specific document
      const existingReqs = requestsList.filter(r => 
        r.record_type === recordType &&
        r.academic_year === matchAy &&
        r.semester === matchSem
      ).sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

      const latestReq = existingReqs.length > 0 ? existingReqs[0] : null;
      const docKey = `${recordType}-${ay}-${sem}`;

      list.push({
        docKey,
        ay,
        sem,
        type,
        name,
        recordType,
        awardName,
        requestStatus: latestReq?.status || null,
        requestId: latestReq?.id || null,
      });
    };

    // Always available standard documents
    pushDoc('All', 'All', 'Academic Record', 'Transcript of Records', 'transcript');
    pushDoc('All', 'All', 'Academic Record', 'Certificate of Grades', 'certificate_of_grades');
    pushDoc('All', 'All', 'Academic Record', 'Copy of Grades', 'copy_of_grades');

    const summary = summaryPayload.summary;
    if (summary) {
      // Latin Honors
      if (summary.latin_honors?.eligible) {
        pushDoc('Overall', 'Graduation', 'Latin Honor', summary.latin_honors.honor, 'latin_honor_certificate', summary.latin_honors.honor);
      }

      // Presidents List
      if (summary.years) {
        summary.years.forEach(yr => {
          if (yr.presidents_list?.eligible) {
            pushDoc(yr.academic_year, 'All', 'Academic Award', 'President\'s List', 'presidents_list_certificate', 'President\'s List');
          }
        });
      }

      // Deans List
      if (summary.terms) {
        summary.terms.forEach(term => {
          if (term.deans_list?.eligible) {
            pushDoc(term.academic_year, term.semester, 'Academic Award', 'Dean\'s List', 'deans_list_certificate', 'Dean\'s List');
          }
        });
      }
    }
    return list;
  }, [summaryPayload, requestsList]);

  return (
    <section className="sd-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="sd-section-title sd-title-red m-0">Request Documents and Awards</h2>
      </div>
      
      <p className="sd-filter-hint mb-6 bg-blue-50 border border-blue-100 p-4 rounded-lg text-blue-800">
        <FiInfo className="sd-info-icon text-blue-500" />
        Request official documents or claim your eligible award certificates here. Standard documents like Transcripts are always available. Award certificates will only appear if you meet the system's eligibility requirements.
      </p>

      <div className="bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse bg-white">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Document Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Document Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Academic Year</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Semester</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Request Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {(summaryLoading || requestsLoading) ? (
                <tr><td colSpan="6" className="py-8 text-center text-gray-500">Loading available documents...</td></tr>
              ) : documentsList.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-gray-500">No documents available.</td></tr>
              ) : (
                documentsList.map((doc) => (
                  <tr key={doc.docKey} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{doc.type}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{doc.name}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{doc.ay}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{doc.sem}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {!doc.requestStatus ? (
                        <span className="text-gray-400 italic">Not Requested</span>
                      ) : doc.requestStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 text-yellow-600 font-medium">
                          <FiClock /> Pending
                        </span>
                      ) : doc.requestStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <FiCheckCircle /> Approved
                        </span>
                      ) : doc.requestStatus === 'released' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                          <FiCheckCircle /> Released
                        </span>
                      ) : (
                        <span className="text-gray-600 capitalize">{doc.requestStatus}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {!doc.requestStatus || doc.requestStatus === 'rejected' ? (
                        <button
                          onClick={() => handleRequest(doc.docKey, doc.recordType, doc.ay, doc.sem, doc.awardName)}
                          disabled={submittingId === doc.docKey}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded text-sm font-medium bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-50"
                        >
                          <FiPlusCircle className="w-4 h-4" />
                          {submittingId === doc.docKey ? 'Requesting...' : 'Request Document'}
                        </button>
                      ) : doc.requestStatus === 'released' ? (
                        <button
                          onClick={() => {
                            if (doc.recordType === 'transcript') handleDownloadTranscript(doc.requestId);
                            else if (doc.recordType === 'certificate_of_grades' || doc.recordType === 'copy_of_grades') studentToast.info('Info', 'This document format is not fully implemented yet.');
                            else generateAwardPdf(doc.name, doc.ay, doc.sem);
                          }}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          <FiDownload className="w-4 h-4" />
                          Download PDF
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">Processing...</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default StudentRequestRecordPage;
