import React, { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import { staffToast } from "../lib/notifications";
import Modal from "../components/ui/Modal";
import { staffApi } from "../lib/api/staffApi";
import { parseApiError } from "../lib/api/errors";
import { queryKeys } from "../lib/react-query/queryKeys";

const defaultForm = {
  student_number: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  sex: "",
  email: "",
  contact_number: "",
  address: "",
  enrollment_date: new Date().toISOString().slice(0, 10),
  graduation_date: "",
  GPA: "",
  program_id: "",
  subject_ids: [],
  record_type: "",
  cabinet_no: "",
  shelf_no: "",
  folder_code: "",
  document_status: "",
};

const TOTAL_PHASES = 5;

const StaffNewStudentPage = ({ basePath = "/staff" }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);

  const { data: programsData, isLoading: loadingPrograms } = useQuery({
    queryKey: ["programs"],
    queryFn: staffApi.getPrograms,
  });

  const { data: curriculumData, isLoading: loadingCurriculum } = useQuery({
    queryKey: ["curriculum", form.program_id],
    queryFn: () => staffApi.getProgramCurriculum(form.program_id),
    enabled: !!form.program_id,
  });

  React.useEffect(() => {
    if (curriculumData?.curriculum) {
      // Default auto-select 1st year, 1st semester subjects
      const firstSemSubjects = curriculumData.curriculum
        .filter((c) => c.year_level === 1 && c.semester === 1)
        .map((c) => c.subject_id);
      setForm((prev) => ({ ...prev, subject_ids: firstSemSubjects }));
    }
  }, [curriculumData]);

  const toggleSubject = (subjectId) => {
    setForm((prev) => {
      const isSelected = prev.subject_ids.includes(subjectId);
      if (isSelected) {
        return { ...prev, subject_ids: prev.subject_ids.filter((id) => id !== subjectId) };
      }
      return { ...prev, subject_ids: [...prev.subject_ids, subjectId] };
    });
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
      if (!form.program_id) err.program_id = "Program is required.";
      if (!form.enrollment_date)
        err.enrollment_date = "Enrollment date is required.";
      if (
        form.GPA !== "" &&
        (isNaN(parseFloat(form.GPA)) ||
          parseFloat(form.GPA) < 0 ||
          parseFloat(form.GPA) > 5)
      ) {
        err.GPA = "GPA must be between 0 and 5.00.";
      }
    }
    if (phase === 5) {
      if (!form.record_type?.trim()) err.record_type = "Record type is required.";
      if (!form.cabinet_no?.trim()) err.cabinet_no = "Cabinet no. is required.";
      if (!form.shelf_no?.trim()) err.shelf_no = "Shelf no. is required.";
      if (!form.folder_code?.trim()) err.folder_code = "Folder code is required.";
      if (!form.document_status?.trim()) err.document_status = "Document status is required.";
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
    if (!form.program_id) err.program_id = "Program is required.";
    if (!form.enrollment_date)
      err.enrollment_date = "Enrollment date is required.";
    if (
      form.GPA !== "" &&
      (isNaN(parseFloat(form.GPA)) ||
        parseFloat(form.GPA) < 0 ||
        parseFloat(form.GPA) > 5)
    ) {
      err.GPA = "GPA must be between 0 and 5.00.";
    }
    if (!form.record_type?.trim()) err.record_type = "Record type is required.";
    if (!form.cabinet_no?.trim()) err.cabinet_no = "Cabinet no. is required.";
    if (!form.shelf_no?.trim()) err.shelf_no = "Shelf no. is required.";
    if (!form.folder_code?.trim()) err.folder_code = "Folder code is required.";
    if (!form.document_status?.trim()) err.document_status = "Document status is required.";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const goNext = () => {
    if (!validatePhase(currentPhase)) return;
    setCurrentPhase((p) => Math.min(p + 1, TOTAL_PHASES));
  };

  const goPrev = () => {
    setCurrentPhase((p) => Math.max(p - 1, 1));
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);
    setCreatedAccount(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        student_number: form.student_number.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth,
        email: form.email.trim(),
        contact_number: form.contact_number?.trim() || null,
        address: form.address?.trim() || null,
        enrollment_date: form.enrollment_date,
        graduation_date: form.graduation_date || null,
        GPA: form.GPA !== "" ? parseFloat(form.GPA) : null,
        sex: form.sex,
        program_id: form.program_id,
        subject_ids: form.subject_ids,
        record_type: form.record_type.trim(),
        cabinet_no: form.cabinet_no.trim(),
        shelf_no: form.shelf_no.trim(),
        folder_code: form.folder_code.trim(),
        document_status: form.document_status.trim(),
      };
      const res = await staffApi.createStudent(payload);
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.staff.all, "students"],
      });
      setSubmitStatus("success");
      setCreatedAccount(
        res?.account
          ? { username: res.account.username, password: res.account.password }
          : { username: form.student_number.trim(), password: "password123" },
      );
      setForm(defaultForm);
      setErrors({});
      setCurrentPhase(1);
      staffToast.success(
        "Student created",
        `Account ${form.student_number.trim()} has been registered.`,
      );
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.errors) {
        const errMap = {};
        Object.keys(parsed.errors).forEach((k) => {
          errMap[k] = parsed.errors[k][0];
        });
        setErrors(errMap);
        // Jump to the first step that has an error
        const phase1Fields = ["student_number", "first_name", "last_name", "date_of_birth"];
        const phase2Fields = ["email", "contact_number", "address"];
        const phase3Fields = ["program_id", "enrollment_date", "graduation_date", "GPA"];
        const phase4Fields = ["subject_ids"];
        const phase5Fields = ["record_type", "cabinet_no", "shelf_no", "folder_code", "document_status"];
        const errorKeys = Object.keys(errMap);
        if (errorKeys.some((k) => phase1Fields.includes(k))) setCurrentPhase(1);
        else if (errorKeys.some((k) => phase2Fields.includes(k))) setCurrentPhase(2);
        else if (errorKeys.some((k) => phase3Fields.includes(k))) setCurrentPhase(3);
        else if (errorKeys.some((k) => phase4Fields.includes(k))) setCurrentPhase(4);
        else if (errorKeys.some((k) => phase5Fields.includes(k))) setCurrentPhase(5);
        const allMessages = Object.values(errMap).join(" · ");
        staffToast.error("Student not created", allMessages || parsed.message || "Please fix the highlighted fields.");
      } else {
        staffToast.error("Student not created", parsed.message || "Failed to create student.");
      }
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setForm(defaultForm);
    setErrors({});
    setSubmitStatus(null);
    setCreatedAccount(null);
    setCurrentPhase(1);
  };

  const closeSuccessModal = () => {
    setCreatedAccount(null);
    setSubmitStatus(null);
  };

  const inputBase =
    "py-2.5 px-4 rounded-lg text-base border transition-colors focus:outline-none focus:ring-2 focus:ring-tmcc/20 focus:border-tmcc";
  const inputError =
    "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20";
  const inputNormal = "border-gray-300";

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
            Add New Student
          </h3>
          <p className="m-0 text-gray-600 text-sm">
            Register a new student account. All fields marked with * are
            required. Data is saved to the student records database per ASRMS
            thesis requirements.
          </p>
        </div>

        <div className="p-6">
          {submitStatus === "success" && (
            <div
              className="py-3 px-4 rounded-lg mb-4 bg-green-100 text-green-800 border border-green-200 text-sm"
              role="status"
            >
              <p className="m-0 mb-2 font-medium">
                Student and account created successfully. You can add another
                below.
              </p>
              {createdAccount && (
                <p className="m-0 text-xs">
                  Account: <strong>Username</strong> {createdAccount.username} ·{" "}
                  <strong>Password</strong> {createdAccount.password}
                </p>
              )}
            </div>
          )}
          {/* Phase stepper */}
          <div
            className="flex items-center justify-center gap-0 py-4 mb-6 bg-gray-50 rounded-lg"
            aria-label="Form phases"
          >
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                    currentPhase === step || currentPhase > step
                      ? "bg-tmcc text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step}
                </span>
                <span
                  className={`text-sm mr-2 ${currentPhase === step ? "text-tmcc font-semibold" : "text-gray-600"}`}
                >
                  Step {step}
                </span>
                {step < 5 && (
                  <span
                    className={`w-8 h-0.5 mx-1 ${currentPhase > step ? "bg-tmcc" : "bg-gray-200"}`}
                  />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="max-w-[720px]">
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
                      placeholder="student@tmcc.edu.ph"
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
                      Contact Number
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
                    Address
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
                {/* <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <h5 className="m-0 mb-3 text-sm font-semibold text-amber-900">Account for Student</h5>
                <p className="m-0 mb-2 text-sm text-amber-800">A login account will be created automatically:</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span><strong>Username:</strong> <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono">{form.student_number || '(student number from Phase 1)'}</code></span>
                  <span><strong>Password:</strong> <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono">password123</code> <span className="text-amber-700">(mock, auto-generated later)</span></span>
                </div>
              </div> */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label htmlFor="program_id" className="text-sm font-medium text-gray-600">
                      Program *
                    </label>
                    <select
                      id="program_id"
                      name="program_id"
                      value={form.program_id}
                      onChange={handleChange}
                      className={`${inputBase} ${errors.program_id ? inputError : inputNormal}`}
                      aria-invalid={!!errors.program_id}
                      disabled={loadingPrograms}
                    >
                      <option value="">
                        {loadingPrograms ? "Loading programs..." : "Select program"}
                      </option>
                      {programsData?.programs?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                    {errors.program_id && (
                      <span className="text-xs text-red-600">{errors.program_id}</span>
                    )}
                  </div>
                </div>

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
                      Graduation Date
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
                  <div className="flex flex-col gap-1.5 max-w-[120px]">
                    <label
                      htmlFor="GPA"
                      className="text-sm font-medium text-gray-600"
                    >
                      GPA
                    </label>
                    <input
                      id="GPA"
                      name="GPA"
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      value={form.GPA}
                      onChange={handleChange}
                      placeholder="0.00–5.00"
                      className={`${inputBase} ${errors.GPA ? inputError : inputNormal}`}
                      aria-invalid={!!errors.GPA}
                    />
                    {errors.GPA && (
                      <span className="text-xs text-red-600">{errors.GPA}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentPhase === 4 && (
              <div className="mb-8 p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
                <h4 className="flex items-center gap-3 m-0 mb-5 pb-3 text-base font-semibold text-gray-800 border-b-2 border-gray-200">
                  <span className="inline-flex items-center justify-center min-w-[4.5rem] py-1.5 px-3 bg-tmcc text-white text-sm font-bold rounded-md tracking-wide">
                    Step 4
                  </span>
                  Curriculum Subjects
                </h4>

                {form.program_id ? (
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <h5 className="m-0 mb-3 text-sm font-semibold text-gray-800">
                      Required Subjects (1st Year, 1st Semester)
                    </h5>
                    <p className="text-sm text-gray-600 mb-4 mt-0">
                      These subjects are locked based on the program selected in Phase 3.
                    </p>
                    {loadingCurriculum ? (
                      <p className="text-sm text-gray-500 m-0">Loading subjects...</p>
                    ) : curriculumData?.curriculum?.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                        {curriculumData.curriculum
                          .filter((c) => c.year_level === 1 && c.semester === 1)
                          .map((c) => (
                            <label
                              key={c.id}
                              className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded opacity-80 cursor-not-allowed"
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                readOnly
                                disabled
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="m-0 text-sm font-medium text-gray-800">
                                  {c.subject?.code} - {c.subject?.title}
                                </p>
                                <p className="m-0 text-xs text-gray-500 mt-0.5">
                                  {c.subject?.units} Units
                                </p>
                              </div>
                            </label>
                          ))}
                        {curriculumData.curriculum.filter((c) => c.year_level === 1 && c.semester === 1).length === 0 && (
                           <p className="text-sm text-gray-500 m-0">No subjects found for 1st Year, 1st Semester.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 m-0">No subjects found in curriculum.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 m-0">Please select a program in Phase 3 first.</p>
                )}
              </div>
            )}


            {currentPhase === 5 && (
              <div className="mb-8 p-6 bg-white rounded-xl border-l-4 border-tmcc shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100">
                <h4 className="flex items-center gap-3 m-0 mb-5 pb-3 text-base font-semibold text-gray-800 border-b-2 border-gray-200">
                  <span className="inline-flex items-center justify-center min-w-[4.5rem] py-1.5 px-3 bg-tmcc text-white text-sm font-bold rounded-md tracking-wide">
                    Step 5
                  </span>
                  Archive Record
                </h4>
                <p className="text-sm text-gray-500 mb-4 mt-0">
                  Physical filing metadata for this student record. All fields are required.
                </p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="record_type" className="text-sm font-medium text-gray-600">
                      Record Type *
                    </label>
                    <input
                      id="record_type"
                      name="record_type"
                      type="text"
                      value={form.record_type}
                      onChange={handleChange}
                      placeholder="e.g. Student Record"
                      maxLength={100}
                      className={`${inputBase} ${errors.record_type ? inputError : inputNormal}`}
                      aria-invalid={!!errors.record_type}
                    />
                    {errors.record_type && (
                      <span className="text-xs text-red-600">{errors.record_type}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="document_status" className="text-sm font-medium text-gray-600">
                      Document Status *
                    </label>
                    <input
                      id="document_status"
                      name="document_status"
                      type="text"
                      value={form.document_status}
                      onChange={handleChange}
                      placeholder="e.g. Active"
                      maxLength={50}
                      className={`${inputBase} ${errors.document_status ? inputError : inputNormal}`}
                      aria-invalid={!!errors.document_status}
                    />
                    {errors.document_status && (
                      <span className="text-xs text-red-600">{errors.document_status}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cabinet_no" className="text-sm font-medium text-gray-600">
                      Cabinet No. *
                    </label>
                    <input
                      id="cabinet_no"
                      name="cabinet_no"
                      type="text"
                      value={form.cabinet_no}
                      onChange={handleChange}
                      placeholder="e.g. CAB-01"
                      maxLength={50}
                      className={`${inputBase} ${errors.cabinet_no ? inputError : inputNormal}`}
                      aria-invalid={!!errors.cabinet_no}
                    />
                    {errors.cabinet_no && (
                      <span className="text-xs text-red-600">{errors.cabinet_no}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="shelf_no" className="text-sm font-medium text-gray-600">
                      Shelf No. *
                    </label>
                    <input
                      id="shelf_no"
                      name="shelf_no"
                      type="text"
                      value={form.shelf_no}
                      onChange={handleChange}
                      placeholder="e.g. SH-03"
                      maxLength={50}
                      className={`${inputBase} ${errors.shelf_no ? inputError : inputNormal}`}
                      aria-invalid={!!errors.shelf_no}
                    />
                    {errors.shelf_no && (
                      <span className="text-xs text-red-600">{errors.shelf_no}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="folder_code" className="text-sm font-medium text-gray-600">
                      Folder Code *
                    </label>
                    <input
                      id="folder_code"
                      name="folder_code"
                      type="text"
                      value={form.folder_code}
                      onChange={handleChange}
                      placeholder="e.g. FLD-2025-001"
                      maxLength={50}
                      className={`${inputBase} ${errors.folder_code ? inputError : inputNormal}`}
                      aria-invalid={!!errors.folder_code}
                    />
                    {errors.folder_code && (
                      <span className="text-xs text-red-600">{errors.folder_code}</span>
                    )}
                  </div>
                </div>
              </div>
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
                    type="submit"
                    className="py-2.5 px-5 rounded-lg text-base font-medium bg-tmcc text-white hover:bg-tmcc-dark disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Add Student"}
                  </button>
                  <button
                    type="button"
                    className="py-2.5 px-5 rounded-lg text-base font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    onClick={clearForm}
                    disabled={loading}
                  >
                    Clear Form
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </section>

      <Modal
        isOpen={!!createdAccount}
        onClose={closeSuccessModal}
        title="Student created"
        titleId="create-success-title"
        maxWidth="max-w-md"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 mb-4">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white">
              <FiCheck className="w-5 h-5" />
            </span>
            <p className="m-0 text-sm text-green-800 font-medium">
              Student and login account have been created successfully.
            </p>
          </div>
          {createdAccount && (
            <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm">
              <p className="m-0 mb-2 font-medium text-gray-700">
                Credentials (share securely):
              </p>
              <p className="m-0">
                <strong>Username:</strong>{" "}
                <code className="px-1.5 py-0.5 rounded bg-gray-200 font-mono">
                  {createdAccount.username}
                </code>
              </p>
              <p className="m-0 mt-1">
                <strong>Password:</strong>{" "}
                <code className="px-1.5 py-0.5 rounded bg-gray-200 font-mono">
                  {createdAccount.password}
                </code>
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                closeSuccessModal();
                clearForm();
              }}
              className="py-2.5 px-5 rounded-lg text-sm font-medium bg-tmcc text-white hover:bg-tmcc-dark focus:ring-2 focus:ring-tmcc/30"
            >
              Add another
            </button>
            <button
              type="button"
              onClick={() => {
                closeSuccessModal();
                navigate(`${basePath}/students`);
              }}
              className="py-2.5 px-5 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500/30"
            >
              Go to Student Records
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default StaffNewStudentPage;
