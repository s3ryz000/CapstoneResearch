import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiPlus,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { staffApi } from "../lib/api/staffApi";
import { staffToast } from "../lib/notifications";
import { queryKeys } from "../lib/react-query/queryKeys";
import AcademicProgressionStep4 from "../components/AcademicProgressionStep4";

const defaultForm = {
  student_number: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  sex: "",
  email: "",
  contact_number: "",
  address: "",
  enrollment_date: "",
  graduation_date: "",

};

const TOTAL_PHASES = 4;

const SEMESTER_OPTIONS = ["1st", "2nd"];
const ENROLLMENT_STATUS_OPTIONS = ["enrolled", "completed", "dropped"];

/**
 * Generates academic year options as "YYYY-YYYY" strings.
 * Includes 3 past years (for existing records) + current year + 5 future years.
 */
const generateAcademicYears = () => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - 3; y <= current + 5; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
};

const ACADEMIC_YEAR_OPTIONS = generateAcademicYears();
const CURRENT_ACADEMIC_YEAR = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

const formatDateForInput = (val) => {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const StaffEditStudentPage = ({ basePath = "/staff" }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const studentFromState = location.state?.student;
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [studentDetail, setStudentDetail] = useState({
    enrollments: [],
    grades: [],
  });
  const [studentProgram, setStudentProgram] = useState(null); // active program object
  const [programs, setPrograms] = useState([]);
  // Program change modal
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [pendingProgramId, setPendingProgramId] = useState("");
  const [programChangeReason, setProgramChangeReason] = useState("");
  const [programChangeRemarks, setProgramChangeRemarks] = useState("");
  const [programChangeLoading, setProgramChangeLoading] = useState(false);
  const [programChangeError, setProgramChangeError] = useState("");
  // Curriculum subjects for enrollment
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const passedSubjectIds = useMemo(() => new Set(
    (studentDetail?.grades ?? [])
      .filter(g => {
        const v = parseFloat(g.grade_value);
        return (!isNaN(v) && v >= 1.0 && v <= 3.0) || g.remarks === 'PASSED';
      })
      .map(g => g.subject_id)
  ), [studentDetail?.grades]);
  const [enrollmentForm, setEnrollmentForm] = useState({
    academic_year: CURRENT_ACADEMIC_YEAR,
    semester: "1st",
    year_level: "",
    status: "enrolled",
  });
  const [gradeForm, setGradeForm] = useState({
    subject_id: "",
    academic_year: "",
    semester: "1st",
    grade_value: "",
    remarks: "",
  });
  const [editingEnrollmentId, setEditingEnrollmentId] = useState(null);
  const [editingGradeId, setEditingGradeId] = useState(null);
  const [enrollmentErrors, setEnrollmentErrors] = useState({});
  const [gradeErrors, setGradeErrors] = useState({});

  // Delete enrollment modal state
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    enrollmentId: null,
    hasGrade: false,
    gradeWarningMsg: "",
    gradeValue: null,
    confirmed: false,
    loading: false,
    reason: "",
  });

  const refreshStudentDetail = (studentId) => {
    if (!studentId) return;
    staffApi
      .getStudentById(studentId)
      .then((res) => {
        const s = res?.student ?? res;
        if (s) {
          setStudentDetail({
            enrollments: s.enrollments || [],
            grades: s.grades || [],
          });
        }
      })
      .catch(() => { });
  };

  useEffect(() => {
    const applyStudent = (s) => {
      if (!s) return;
      const parts = s.name ? s.name.split(" ") : [];
      setForm({
        student_number: s.student_number ?? s.student_id ?? "",
        first_name: s.first_name ?? parts[0] ?? "",
        last_name: s.last_name ?? parts.slice(1).join(" ") ?? "",
        date_of_birth: formatDateForInput(s.date_of_birth),
        sex: s.sex === 'Male' || s.sex === 'male' ? 'M'
          : s.sex === 'Female' || s.sex === 'female' ? 'F'
            : (s.sex ?? ""),
        email: s.email ?? "",
        contact_number: s.contact_number ?? "",
        address: s.address ?? "",
        enrollment_date:
          formatDateForInput(s.enrollment_date) ||
          new Date().toISOString().slice(0, 10),
        graduation_date: formatDateForInput(s.graduation_date),

      });
      setStudentDetail({
        enrollments: s.enrollments || [],
        grades: s.grades || [],
      });
      // Set active program
      if (s.program) {
        setStudentProgram(s.program);
      } else if (s.program_id) {
        setStudentProgram({ id: s.program_id, code: '', name: '' });
      } else {
        setStudentProgram(null);
      }
    };

    if (!id) {
      if (studentFromState) applyStudent(studentFromState);
      setFetchLoading(false);
      return;
    }

    setFetchLoading(true);
    // Clear drafts to prevent state leaks between students
    setStudentDetail({ enrollments: [], grades: [] });
    setSelectedSubjectIds([]);
    setEnrollmentForm({
      academic_year: CURRENT_ACADEMIC_YEAR,
      semester: "1st",
      year_level: "",
      status: "enrolled",
    });
    setGradeForm({
      subject_id: "",
      academic_year: "",
      semester: "1st",
      grade_value: "",
      remarks: "",
    });

    staffApi
      .getStudentById(id)
      .then((res) => {
        const s = res?.student ?? res;
        applyStudent(s);
      })
      .catch(() => setSubmitStatus("Failed to load student. Please try again."))
      .finally(() => setFetchLoading(false));
  }, [id, studentFromState]);

  useEffect(() => {
    staffApi
      .getPrograms()
      .then((res) => setPrograms(res?.programs || []))
      .catch(() => setPrograms([]));
  }, []);

  // Fetch curriculum subjects when enrollment form year_level or semester changes
  const fetchCurriculum = async (yearLevel, semester) => {
    if (!studentProgram?.id || !yearLevel || !semester) {
      setCurriculumSubjects([]);
      setSelectedSubjectIds([]);
      return;
    }
    setCurriculumLoading(true);
    try {
      const res = await staffApi.getProgramCurriculumFiltered(studentProgram.id, yearLevel, semester);
      const items = res?.curriculum || [];
      setCurriculumSubjects(items);
      // Pre-select all by default
      setSelectedSubjectIds(items.map((c) => c.subject_id));
    } catch {
      setCurriculumSubjects([]);
      setSelectedSubjectIds([]);
    } finally {
      setCurriculumLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    if (submitStatus) setSubmitStatus(null);
  };

  const validatePhase = (phase) => {
    const err = {};
    if (phase === 1) {
      if (!form.student_number?.trim())
        err.student_number = "Student number is required.";
      if (!form.first_name?.trim()) err.first_name = "First name is required.";
      if (!form.last_name?.trim()) err.last_name = "Last name is required.";
      if (!form.date_of_birth) err.date_of_birth = "Date of birth is required.";
      if (!form.sex) err.sex = "Sex is required.";
    }
    if (phase === 2) {
      if (!form.email?.trim()) err.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        err.email = "Enter a valid email.";
    }
    if (phase === 3) {
      if (!form.enrollment_date)
        err.enrollment_date = "Enrollment date is required.";

    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validate = () => {
    const err = {};
    if (!form.student_number?.trim())
      err.student_number = "Student number is required.";
    if (!form.first_name?.trim()) err.first_name = "First name is required.";
    if (!form.last_name?.trim()) err.last_name = "Last name is required.";
    if (!form.date_of_birth) err.date_of_birth = "Date of birth is required.";
    if (!form.sex) err.sex = "Sex is required.";
    if (!form.email?.trim()) err.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      err.email = "Enter a valid email.";
    if (!form.enrollment_date)
      err.enrollment_date = "Enrollment date is required.";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const goToPhase = (phase) => {
    if (phase < currentPhase || validatePhase(phase)) {
      setCurrentPhase(phase);
      if (phase < currentPhase) setErrors({});
    }
  };

  const handleProgramDropdownChange = (newProgramId) => {
    if (!newProgramId) return;
    if (studentProgram && String(studentProgram.id) === String(newProgramId)) return;
    // If student already has a program, show confirmation modal
    if (studentProgram?.id) {
      setPendingProgramId(newProgramId);
      setProgramChangeReason("");
      setProgramChangeRemarks("");
      setProgramChangeError("");
      setShowProgramModal(true);
    } else {
      // No existing program — set directly
      confirmProgramSet(newProgramId);
    }
  };

  const confirmProgramSet = async (programId) => {
    // Initial set: just call updateStudentProgram with reason 'Initial assignment'
    if (!studentId) return;
    setProgramChangeLoading(true);
    try {
      const res = await staffApi.updateStudentProgram(studentId, {
        new_program_id: programId,
        reason: 'Initial assignment',
      });
      const prog = programs.find((p) => String(p.id) === String(programId));
      setStudentProgram(prog || res?.student?.program || { id: programId });
      staffToast.success('Program set', 'Student program has been assigned.');
    } catch (err) {
      staffToast.error('Failed', err?.response?.data?.message || 'Could not set program.');
    } finally {
      setProgramChangeLoading(false);
    }
  };

  const confirmProgramChange = async () => {
    if (!programChangeReason) {
      setProgramChangeError('Reason is required.');
      return;
    }
    if (!studentId) return;
    setProgramChangeLoading(true);
    setProgramChangeError("");
    try {
      const res = await staffApi.updateStudentProgram(studentId, {
        new_program_id: pendingProgramId,
        reason: programChangeReason,
        remarks: programChangeRemarks || undefined,
      });
      const prog = programs.find((p) => String(p.id) === String(pendingProgramId));
      setStudentProgram(prog || res?.student?.program || { id: pendingProgramId });
      setCurriculumSubjects([]);
      setSelectedSubjectIds([]);
      setEnrollmentForm({ academic_year: CURRENT_ACADEMIC_YEAR, semester: '1st', year_level: '', status: 'enrolled' });
      setShowProgramModal(false);
      staffToast.success('Program changed', `Archived ${res?.archived_count ?? 0} enrollment(s). New program loaded.`);
    } catch (err) {
      setProgramChangeError(err?.response?.data?.message || 'Could not change program.');
    } finally {
      setProgramChangeLoading(false);
    }
  };

  const goNext = () => {
    if (!validatePhase(currentPhase)) return;
    setCurrentPhase((p) => Math.min(p + 1, TOTAL_PHASES));
  };

  const goPrev = () => {
    setCurrentPhase((p) => Math.max(p - 1, 1));
    setErrors({});
  };

  const studentId = id ?? studentFromState?.student_id ?? studentFromState?.id;

  const handleAddEnrollment = async (e) => {
    e.preventDefault();
    setEnrollmentErrors({});
    const errs = {};
    if (!enrollmentForm.academic_year?.trim()) errs.academic_year = "Academic year is required.";
    if (!enrollmentForm.semester?.trim()) errs.semester = "Semester is required.";
    if (!enrollmentForm.year_level) errs.year_level = "Year level is required.";
    if (!studentProgram?.id) errs.program = "Student has no active program set.";
    if (selectedSubjectIds.length === 0) errs.subject_ids = "Please select at least one subject.";
    if (Object.keys(errs).length > 0) { setEnrollmentErrors(errs); return; }
    if (!studentId) return;
    try {
      await staffApi.createEnrollment(studentId, {
        academic_year: enrollmentForm.academic_year.trim(),
        semester: enrollmentForm.semester.trim(),
        status: enrollmentForm.status || "enrolled",
        year_level: Number(enrollmentForm.year_level),
        subject_ids: selectedSubjectIds,
      });
      staffToast.success("Enrollment added", "Subjects enrolled successfully.");
      setEnrollmentForm({ academic_year: CURRENT_ACADEMIC_YEAR, semester: "1st", year_level: "", status: "enrolled" });
      setCurriculumSubjects([]);
      setSelectedSubjectIds([]);
      refreshStudentDetail(studentId);
    } catch (err) {
      const data = err?.response?.data;
      const errList = data?.errors || {};
      setEnrollmentErrors(
        Object.fromEntries(Object.entries(errList).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : v])),
      );
      staffToast.error("Enrollment failed", data?.message || "Could not add enrollment.",
      );
    }
  };

  const handleUpdateEnrollment = async (e) => {
    e.preventDefault();
    if (editingEnrollmentId == null || !studentId) return;
    setEnrollmentErrors({});
    const enr = studentDetail.enrollments.find(
      (e) => e.id === editingEnrollmentId,
    );
    if (!enr) return;
    const payload = { status: enrollmentForm.status || "enrolled" };
    try {
      await staffApi.updateEnrollment(studentId, editingEnrollmentId, payload);
      staffToast.success("Enrollment updated", "Status updated.");
      setEditingEnrollmentId(null);
      setEnrollmentForm({
        subject_id: "",
        academic_year: CURRENT_ACADEMIC_YEAR,
        semester: "1st",
        status: "enrolled",
      });
      refreshStudentDetail(studentId);
    } catch (err) {
      staffToast.error(
        "Update failed",
        err?.response?.data?.message || "Could not update enrollment.",
      );
    }
  };

  // Step 1: Open delete modal (no grade check yet - backend does it)
  const handleDeleteEnrollment = (enrollmentId) => {
    setDeleteModal({
      open: true,
      enrollmentId,
      hasGrade: false,
      gradeWarningMsg: "",
      gradeValue: null,
      confirmed: false,
      loading: false,
      reason: "",
    });
  };

  // Step 2: Perform the actual delete (called from modal confirm button)
  const performDeleteEnrollment = async (confirmed = false) => {
    const { enrollmentId, reason } = deleteModal;
    if (!studentId || !enrollmentId) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      await staffApi.deleteEnrollment(studentId, enrollmentId, {
        confirmed,
        reason: reason || undefined,
      });
      staffToast.success("Enrollment removed", "Subject enrollment removed successfully.");
      setDeleteModal({ open: false, enrollmentId: null, hasGrade: false, gradeWarningMsg: "", gradeValue: null, confirmed: false, loading: false, reason: "" });
      refreshStudentDetail(studentId);
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.requires_confirmation) {
        // Backend says there's a grade — show the stronger warning in the modal
        setDeleteModal((prev) => ({
          ...prev,
          hasGrade: true,
          gradeWarningMsg: data.message,
          gradeValue: data.grade_value,
          confirmed: true, // next click will pass confirmed=true
          loading: false,
        }));
      } else {
        staffToast.error(
          "Delete failed",
          data?.message || "Could not remove subject enrollment. Database was not updated.",
        );
        setDeleteModal((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const startEditEnrollment = (enrollment) => {
    setEditingEnrollmentId(enrollment.id);
    setEnrollmentForm({
      subject_id: enrollment.subject_id,
      academic_year: enrollment.academic_year,
      semester: enrollment.semester,
      status: enrollment.status || "enrolled",
    });
  };

  const handleAddGrade = async (e) => {
    e.preventDefault();
    setGradeErrors({});
    if (
      !gradeForm.subject_id ||
      !gradeForm.academic_year?.trim() ||
      !gradeForm.semester?.trim()
    ) {
      setGradeErrors({
        subject_id: !gradeForm.subject_id ? "Subject is required." : null,
        academic_year: !gradeForm.academic_year?.trim()
          ? "Academic year is required."
          : null,
        semester: !gradeForm.semester?.trim() ? "Semester is required." : null,
      });
      return;
    }
    const gv =
      gradeForm.grade_value !== "" && gradeForm.grade_value != null
        ? parseFloat(gradeForm.grade_value)
        : null;
    if (gv != null && (isNaN(gv) || gv < 0 || gv > 5)) {
      setGradeErrors({ grade_value: "Grade must be between 0 and 5.00." });
      return;
    }
    if (!studentId) return;
    try {
      await staffApi.createGrade(studentId, {
        subject_id: Number(gradeForm.subject_id),
        academic_year: gradeForm.academic_year.trim(),
        semester: gradeForm.semester.trim(),
        grade_value: gv,
        remarks: gradeForm.remarks?.trim() || null,
      });
      staffToast.success("Grade added", "Grade recorded.");
      setGradeForm({
        subject_id: "",
        academic_year: "",
        semester: "1st",
        grade_value: "",
        remarks: "",
      });
      refreshStudentDetail(studentId);
    } catch (err) {
      const data = err?.response?.data;
      const errList = data?.errors || {};
      setGradeErrors(
        Object.fromEntries(
          Object.entries(errList).map(([k, v]) => [
            k,
            Array.isArray(v) ? v[0] : v,
          ]),
        ),
      );
      staffToast.error("Grade failed", data?.message || "Could not add grade.");
    }
  };

  const handleUpdateGrade = async (e) => {
    e.preventDefault();
    if (editingGradeId == null || !studentId) return;
    setGradeErrors({});
    const gv =
      gradeForm.grade_value !== "" && gradeForm.grade_value != null
        ? parseFloat(gradeForm.grade_value)
        : null;
    if (gv != null && (isNaN(gv) || gv < 0 || gv > 5)) {
      setGradeErrors({ grade_value: "Grade must be between 0 and 5.00." });
      return;
    }
    try {
      await staffApi.updateGrade(studentId, editingGradeId, {
        grade_value: gv,
        remarks: gradeForm.remarks?.trim() || null,
      });
      staffToast.success("Grade updated", "");
      setEditingGradeId(null);
      setGradeForm({
        subject_id: "",
        academic_year: "",
        semester: "1st",
        grade_value: "",
        remarks: "",
      });
      refreshStudentDetail(studentId);
    } catch (err) {
      staffToast.error(
        "Update failed",
        err?.response?.data?.message || "Could not update grade.",
      );
    }
  };

  const handleDeleteGrade = async (gradeId) => {
    if (!studentId || !window.confirm("Remove this grade?")) return;
    try {
      await staffApi.deleteGrade(studentId, gradeId);
      staffToast.success("Grade removed", "");
      refreshStudentDetail(studentId);
    } catch (err) {
      staffToast.error(
        "Delete failed",
        err?.response?.data?.message || "Could not remove grade.",
      );
    }
  };

  const startEditGrade = (grade) => {
    setEditingGradeId(grade.id);
    setGradeForm({
      subject_id: grade.subject_id,
      academic_year: grade.academic_year,
      semester: grade.semester,
      grade_value: grade.grade_value != null ? String(grade.grade_value) : "",
      remarks: grade.remarks || "",
    });
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSubmitStatus(null);
    if (!validate()) return;

    setLoading(true);
    const updateId = id ?? studentFromState?.student_id ?? studentFromState?.id;
    if (!updateId) {
      setSubmitStatus("Cannot update: student ID is missing.");
      setLoading(false);
      return;
    }

    try {
      await staffApi.updateStudent(updateId, {
        student_number: form.student_number.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth,
        sex: form.sex,
        email: form.email.trim(),
        contact_number: form.contact_number?.trim() || null,
        address: form.address?.trim() || null,
        enrollment_date: form.enrollment_date,
        graduation_date: form.graduation_date || null,

      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.staff.all, "students"],
      });
      setSubmitStatus("success");
      staffToast.success(
        "Student updated",
        "Record saved successfully. Redirecting to Student Records.",
      );
      setTimeout(() => navigate(`${basePath}/students`), 1500);
    } catch (err) {
      const data = err?.response?.data;
      let msg = data?.message || "Failed to update student.";
      const errors = data?.errors;
      if (errors && typeof errors === "object" && !Array.isArray(errors)) {
        const parts = Object.values(errors).flat().filter(Boolean);
        if (parts.length) msg = parts.join(" ");
      }
      setSubmitStatus(msg);
      staffToast.error("Update failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "py-2.5 px-4 rounded-lg text-base border transition-colors focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc";
  const inputError =
    "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20";
  const inputNormal = "border-gray-300";

  if (fetchLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 border-2 border-tmcc border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-600">Loading student...</p>
      </div>
    );
  }

  return (
    <>
      <Link
        to={`${basePath}/students`}
        className="inline-flex items-center gap-2 mb-6 text-tmcc text-sm font-medium no-underline hover:text-tmcc-dark hover:underline"
      >
        <FiArrowLeft /> Back to Student Records
      </Link>

      <section className="bg-white rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="mt-0 mb-2 text-xl font-bold text-gray-800">
            Edit Student
          </h3>
          <p className="m-0 text-gray-600 text-sm">
            Update student information. All fields marked with * are required.
            Changes are saved to the student records database per ASRMS thesis
            requirements.
          </p>
        </div>

        <div className="p-6">
          <div
            className="flex items-center justify-center gap-0 py-4 mb-6 bg-gray-50 rounded-lg flex-wrap"
            aria-label="Form steps"
          >
            {[1, 2, 3, 4].map((phase) => (
              <div key={phase} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPhase(phase)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-tmcc/50 ${currentPhase === phase || currentPhase > phase
                    ? "bg-tmcc text-white hover:bg-tmcc-dark"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  aria-pressed={currentPhase === phase}
                  aria-label={`Step ${phase}`}
                >
                  {phase}
                </button>
                <button
                  type="button"
                  onClick={() => goToPhase(phase)}
                  className={`text-sm mr-2 focus:outline-none focus:ring-2 focus:ring-tmcc/30 rounded px-1 ${currentPhase === phase ? "text-tmcc font-semibold" : "text-gray-600 hover:text-gray-800"}`}
                >
                  Step {phase}
                </button>
                {phase < 4 && (
                  <span
                    className={`w-10 h-0.5 mx-1 ${currentPhase > phase ? "bg-tmcc" : "bg-gray-200"}`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="w-full max-w-full mx-auto">
            {currentPhase === 1 && (
              <div className="mb-8 p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
                <h4 className="flex items-center gap-3 m-0 mb-5 pb-3 text-base font-semibold text-gray-800 border-b-2 border-gray-200">
                  <span className="inline-flex items-center justify-center min-w-[4.5rem] py-1.5 px-3 bg-tmcc text-white text-sm font-bold rounded-md tracking-wide">
                    Step 1
                  </span>
                  Personal Information
                </h4>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="student_number"
                      className="text-sm font-medium text-gray-600"
                    >
                      Student Number *
                    </label>
                    <input
                      id="student_number"
                      name="student_number"
                      type="text"
                      value={form.student_number}
                      onChange={handleChange}
                      placeholder="e.g. STU-2025-001"
                      maxLength={20}
                      className={`${inputBase} ${errors.student_number ? inputError : inputNormal}`}
                      aria-invalid={!!errors.student_number}
                    />
                    {errors.student_number && (
                      <span className="text-xs text-red-600">
                        {errors.student_number}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="date_of_birth"
                      className="text-sm font-medium text-gray-600"
                    >
                      Date of Birth *
                    </label>
                    <input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={form.date_of_birth}
                      onChange={handleChange}
                      className={`${inputBase} ${errors.date_of_birth ? inputError : inputNormal}`}
                      aria-invalid={!!errors.date_of_birth}
                    />
                    {errors.date_of_birth && (
                      <span className="text-xs text-red-600">
                        {errors.date_of_birth}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="sex"
                      className="text-sm font-medium text-gray-600"
                    >
                      Sex *
                    </label>
                    <select
                      id="sex"
                      name="sex"
                      value={form.sex}
                      onChange={handleChange}
                      className={`${inputBase} ${errors.sex ? inputError : inputNormal}`}
                      aria-invalid={!!errors.sex}
                    >
                      <option value="">Select sex</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                    {errors.sex && (
                      <span className="text-xs text-red-600">{errors.sex}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="first_name"
                      className="text-sm font-medium text-gray-600"
                    >
                      First Name *
                    </label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Given name"
                      maxLength={50}
                      className={`${inputBase} ${errors.first_name ? inputError : inputNormal}`}
                      aria-invalid={!!errors.first_name}
                    />
                    {errors.first_name && (
                      <span className="text-xs text-red-600">
                        {errors.first_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="last_name"
                      className="text-sm font-medium text-gray-600"
                    >
                      Last Name *
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Family name"
                      maxLength={50}
                      className={`${inputBase} ${errors.last_name ? inputError : inputNormal}`}
                      aria-invalid={!!errors.last_name}
                    />
                    {errors.last_name && (
                      <span className="text-xs text-red-600">
                        {errors.last_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentPhase === 2 && (
              <div className="mb-8 p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
                <h4 className="flex items-center gap-3 m-0 mb-5 pb-3 text-base font-semibold text-gray-800 border-b-2 border-gray-200">
                  <span className="inline-flex items-center justify-center min-w-[4.5rem] py-1.5 px-3 bg-tmcc text-white text-sm font-bold rounded-md tracking-wide">
                    Step 2
                  </span>
                  Contact Information
                </h4>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-600"
                    >
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="[EMAIL_ADDRESS]"
                      maxLength={100}
                      className={`${inputBase} ${errors.email ? inputError : inputNormal}`}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <span className="text-xs text-red-600">
                        {errors.email}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="contact_number"
                      className="text-sm font-medium text-gray-600"
                    >
                      Contact Number (optional)
                    </label>
                    <input
                      id="contact_number"
                      name="contact_number"
                      type="tel"
                      value={form.contact_number}
                      onChange={handleChange}
                      placeholder="09XXXXXXXXX"
                      maxLength={15}
                      className={`${inputBase} ${inputNormal}`}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="address"
                    className="text-sm font-medium text-gray-600"
                  >
                    Address (optional)
                  </label>
                  <input
                    id="address"
                    name="address"
                    type="text"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Street, Barangay, City"
                    maxLength={150}
                    className={`${inputBase} ${inputNormal}`}
                  />
                </div>
              </div>
            )}

            {currentPhase === 3 && (
              <div className="mb-8 p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
                <h4 className="flex items-center gap-3 m-0 mb-5 pb-3 text-base font-semibold text-gray-800 border-b-2 border-gray-200">
                  <span className="inline-flex items-center justify-center min-w-[4.5rem] py-1.5 px-3 bg-tmcc text-white text-sm font-bold rounded-md tracking-wide">
                    Step 3
                  </span>
                  Enrollment Information
                </h4>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="enrollment_date"
                      className="text-sm font-medium text-gray-600"
                    >
                      Enrollment Date *
                    </label>
                    <input
                      id="enrollment_date"
                      name="enrollment_date"
                      type="date"
                      value={form.enrollment_date}
                      onChange={handleChange}
                      className={`${inputBase} ${errors.enrollment_date ? inputError : inputNormal}`}
                      aria-invalid={!!errors.enrollment_date}
                    />
                    {errors.enrollment_date && (
                      <span className="text-xs text-red-600">
                        {errors.enrollment_date}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="graduation_date"
                      className="text-sm font-medium text-gray-600"
                    >
                      Graduation Date (optional)
                    </label>
                    <input
                      id="graduation_date"
                      name="graduation_date"
                      type="date"
                      value={form.graduation_date}
                      onChange={handleChange}
                      className={`${inputBase} ${inputNormal}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentPhase === 4 && (
              <AcademicProgressionStep4
                studentId={studentId}
                studentProgram={studentProgram}
                programs={programs}
                handleProgramDropdownChange={handleProgramDropdownChange}
                programChangeLoading={programChangeLoading}
                inputBase={inputBase}
                inputNormal={inputNormal}
                inputError={inputError}
              />
            )}

            <div className="flex gap-4 mt-6 pt-4 border-t border-gray-200">
              {currentPhase > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg text-base font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={goPrev}
                  disabled={loading}
                >
                  <FiArrowLeft /> Previous
                </button>
              )}
              {currentPhase < TOTAL_PHASES ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg text-base font-medium bg-tmcc text-white hover:bg-tmcc-dark"
                  onClick={goNext}
                >
                  Next <FiArrowRight />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="py-2.5 px-5 rounded-lg text-base font-medium bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <Link
                    to={`${basePath}/students`}
                    className="py-2.5 px-5 rounded-lg text-base font-medium bg-gray-600 text-white hover:bg-gray-700 no-underline inline-block"
                    onClick={(e) => loading && e.preventDefault()}
                  >
                    Cancel
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Program Change Confirmation Modal ── */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Change Student Program?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Changing this student's program will <strong>archive all current active subject enrollments</strong>.
              Grades will be preserved. The new program's curriculum will become available for enrollment.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Reason for program change *</label>
                <select
                  value={programChangeReason}
                  onChange={(e) => setProgramChangeReason(e.target.value)}
                  className="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                >
                  <option value="">— Select reason —</option>
                  <option value="Shifted program">Shifted program</option>
                  <option value="Wrong initial encoding">Wrong initial encoding</option>
                  <option value="Transfer student">Transfer student</option>
                  <option value="Administrative correction">Administrative correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Remarks (optional)</label>
                <textarea
                  value={programChangeRemarks}
                  onChange={(e) => setProgramChangeRemarks(e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc resize-none"
                />
              </div>
              {programChangeError && <p className="text-xs text-red-600 m-0">{programChangeError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={confirmProgramChange}
                disabled={programChangeLoading}
                className="flex-1 py-2 px-4 rounded-lg bg-tmcc text-white text-sm font-medium disabled:opacity-70"
              >
                {programChangeLoading ? "Saving..." : "Confirm Change"}
              </button>
              <button
                type="button"
                onClick={() => { setShowProgramModal(false); setPendingProgramId(""); }}
                disabled={programChangeLoading}
                className="flex-1 py-2 px-4 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Enrollment Confirmation Modal ── */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            {deleteModal.hasGrade ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 text-lg font-bold">!</span>
                  <h3 className="text-lg font-bold text-gray-900">Grade Exists — Confirm Removal</h3>
                </div>
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                  {deleteModal.gradeWarningMsg}
                  {deleteModal.gradeValue != null && (
                    <span className="block mt-1 font-semibold">Recorded grade: {deleteModal.gradeValue}</span>
                  )}
                </p>
                <div className="mb-3">
                  <label className="text-sm font-medium text-gray-700">Reason for removal *</label>
                  <input
                    type="text"
                    value={deleteModal.reason}
                    onChange={(e) => setDeleteModal((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Enter reason (required when grade exists)"
                    className="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                  />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Subject Enrollment?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will archive the enrollment record. The subject will no longer appear as active and can be re-enrolled later if needed.
                </p>
                <div className="mb-3">
                  <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
                  <input
                    type="text"
                    value={deleteModal.reason}
                    onChange={(e) => setDeleteModal((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Optional reason"
                    className="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc"
                  />
                </div>
              </>
            )}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (deleteModal.hasGrade && !deleteModal.reason?.trim()) {
                    staffToast.error("Reason required", "Please provide a reason when removing a graded subject.");
                    return;
                  }
                  performDeleteEnrollment(deleteModal.confirmed);
                }}
                disabled={deleteModal.loading}
                className={`flex-1 py-2 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-70 ${deleteModal.hasGrade ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {deleteModal.loading ? "Removing..." : deleteModal.hasGrade ? "Confirm — Archive Enrollment" : "Remove Enrollment"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, enrollmentId: null, hasGrade: false, gradeWarningMsg: "", gradeValue: null, confirmed: false, loading: false, reason: "" })}
                disabled={deleteModal.loading}
                className="flex-1 py-2 px-4 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffEditStudentPage;
