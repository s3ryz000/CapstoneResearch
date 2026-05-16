<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Http\Requests\StoreStudentRequest;
use App\Http\Requests\UpdateStudentRequest;
use App\Models\ArchiveRecord;
use App\Models\Curriculum;
use App\Services\OfficialTranscriptExportService;
use App\Models\Enrollment;
use App\Models\EnrollmentAuditLog;
use App\Models\Grade;
use App\Models\Program;
use App\Models\ProgramChangeLog;
use App\Models\ProgramMapping;
use App\Models\Student;
use App\Models\Subject;
use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentController extends Controller
{
    use AuthorizesRole;


    /**
     * List students with search, filter by course/status, pagination (staff + admin).
     */
    public function index(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $query = Student::query()->with(['user:id,name,username,email', 'program:id,code,name', 'archiveRecords']);
        if ($search = $request->input('search')) {
            $search = preg_replace('/\s+/', ' ', trim($search));
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('student_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
                });
        }
        
        if ($program = $request->input('program')) {
            $program = trim((string) $program);
            if ($program !== '') {
                $query->whereHas('program', function ($q) use ($program) {
                    $q->where('code', $program)->orWhere('name', $program);
                });
            }
        }

        $sortKey = $request->input('sort', 'last_name');
        $sortDir = $request->input('dir', 'asc') === 'desc' ? 'desc' : 'asc';

        $allowedColumns = ['student_id', 'student_number', 'first_name', 'last_name', 'email'];
        if ($sortKey === 'name') {
            $query->orderBy('last_name', $sortDir)->orderBy('first_name', $sortDir);
        } elseif ($sortKey === 'course') {
            $query->leftJoin('programs', 'students.program_id', '=', 'programs.id')
                ->select('students.*')
                ->orderBy('programs.code', $sortDir);
        } elseif (in_array($sortKey, $allowedColumns, true)) {
            $query->orderBy($sortKey, $sortDir);
        } elseif ($sortKey === 'status') {
            $query->orderBy('students.student_id', $sortDir);
        } else {
            $query->orderBy('last_name', 'asc');
        }

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $students = $query->paginate($perPage);
        // Log::info(ArchiveRecord::where('student_id', $students?->first()?->student_id)->get());

        return response()->json($students);
    }

    /**
     * Store a newly created student and their login account (staff/admin only).
     */
    public function store(StoreStudentRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $role = $user->roles->first()?->name ?? $user->role ?? null;
        if (! in_array($role, ['staff', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden. Staff or Admin only.'], 403);
        }

        $validated = $request->validated();
        $validated['GPA'] = isset($validated['GPA']) ? round((float) $validated['GPA'], 2) : null;

        $subjectIds = $validated['subject_ids'] ?? [];
        unset($validated['subject_ids']);

        $studentNumber = $validated['student_number'];
        $name = trim($validated['first_name'] . ' ' . $validated['last_name']);
        $email = $validated['email'];
        $exactPassword = User::generatePassword();
        $student = DB::transaction(function () use ($validated, $studentNumber, $name, $email, $exactPassword, $subjectIds) {
            $account = User::create([
                'name' => $name,
                'email' => $email,
                'username' => $studentNumber,
                'role' => 'student',
                'password' => Hash::make($exactPassword),
            ]);
            $account->assignRole('student');

            $studentData = $validated;
            $studentData['user_id'] = $account->id;

            $student = Student::create($studentData);

            if (!empty($subjectIds)) {
                $academicYear = \App\Models\SystemSetting::getValue('academic_year') ?: date('Y') . '-' . (date('Y') + 1);
                $semesterStr = \App\Models\SystemSetting::getValue('semester') ?: '1st Semester';
                $semester = (strpos(strtolower($semesterStr), '2nd') !== false) ? 2 : 1;

                foreach ($subjectIds as $subjectId) {
                    Enrollment::create([
                        'student_id' => $student->student_id,
                        'subject_id' => $subjectId,
                        'academic_year' => $academicYear,
                        'semester' => $semester,
                        'status' => 'enrolled',
                    ]);
                }

                \App\Models\ProgramMapping::create([
                    'student_id' => $student->student_id,
                    'program_id' => $student->program_id,
                    'academic_year' => $academicYear,
                    'semester' => $semester,
                    'status' => 'enrolled',
                    'year_level' => 1,
                ]);
            }

            return $student;
        });

        // create archive record
        if($validated['is_archived']) {
            $archiveRecord = ArchiveRecord::create([
                'student_id' => $student->student_id,
                'record_type' => $validated['record_type'],
                'cabinet_no' => $validated['cabinet_no'],
                'shelf_no' => $validated['shelf_no'],
                'folder_code' => $validated['folder_code'],
                'document_status' => $validated['document_status'],
            ]);
    
            if (!$archiveRecord) {
                return response()->json(['message' => 'Failed to create archive record.'], 500);
            }
        }

        SystemLog::create([
            'action' => 'Student created',
            'user_id' => $user->id,
            'role' => $role,
        ]);
        return response()->json([
            'message' => 'Student and account created successfully.',
            'student' => $student,
            'account' => [
                'username' => $studentNumber,
                'password' => $exactPassword,
            ],
        ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create student and account: ' . $e->getMessage());
           return response()->json(['message' => 'Failed to create student and account.'], 500);
        }
    }

    /**
     * Display the specified student (staff/admin only).
     */
    public function show(int $id): JsonResponse
    {
        $user = request()->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $role = $user->roles->first()?->name ?? $user->role ?? null;
        if (! in_array($role, ['staff', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden. Staff or Admin only.'], 403);
        }

        $student = Student::with([
            'program',
            'enrollments' => function ($q) {
                // Only return non-soft-deleted enrollments to the frontend
                $q->whereNull('deleted_at')->with('subject');
            },
            'grades.subject',
            'archiveRecords',
        ])->find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        Log::info($student);
        return response()->json(['student' => $student]);
    }

    /**
     * Download official transcript XLSX for a student (staff/admin only).
     */
    public function downloadTranscript(int $id): StreamedResponse|JsonResponse
    {
        $user = request()->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $role = $user->roles->first()?->name ?? $user->role ?? null;
        if (! in_array($role, ['staff', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden. Staff or Admin only.'], 403);
        }

        $student = Student::with(['program', 'grades.subject'])->find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $templatePath = public_path('assets/templates/OFFICIAL TRANSCRIPT OF RECORD - template.xlsx');
        if (! file_exists($templatePath)) {
            return response()->json(['message' => 'Transcript template file not found.'], 500);
        }

        return app(OfficialTranscriptExportService::class)->streamForStudent($student);
    }

    /**
     * Update the specified student (staff/admin only).
     */
    public function update(UpdateStudentRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $role = $user->roles->first()?->name ?? $user->role ?? null;
        if (! in_array($role, ['staff', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden. Staff or Admin only.'], 403);
        }

        $student = Student::find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $validated = $request->validated();
        $validated['GPA'] = isset($validated['GPA']) ? round((float) $validated['GPA'], 2) : null;

        $studentNumber = $validated['student_number'];
        $name = trim($validated['first_name'] . ' ' . $validated['last_name']);
        $email = $validated['email'];

        DB::transaction(function () use ($student, $validated, $studentNumber, $name, $email) {
            $student->update($validated);

            if ($student->user) {
                $student->user->update([
                    'name' => $name,
                    'email' => $email,
                    'username' => $studentNumber,
                ]);
            }
        });

        $student->refresh();
        SystemLog::create([
            'action' => 'Student updated',
            'user_id' => $user->id,
            'role' => $role,
        ]);
        return response()->json([
            'message' => 'Student updated successfully.',
            'student' => $student,
        ]);
    }

    /**
     * List programs for staff filters (course dropdown).
     */
    public function programs(): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles(request()->user(), ['staff', 'admin'])) {
            return $err;
        }
        $programs = Program::orderBy('code')->get(['id', 'code', 'name']);

        return response()->json(['programs' => $programs]);
    }

    /**
     * Update (or set) a student's active program. Archives old program enrollments.
     * Requires: new_program_id, reason. Optional: remarks.
     */
    public function updateProgram(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $role = $user->roles->first()?->name ?? $user->role ?? null;
        if (! in_array($role, ['staff', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $student = Student::find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $validated = $request->validate([
            'new_program_id' => ['required', 'integer', 'exists:programs,id'],
            'reason'         => ['required', 'string', 'max:100'],
            'remarks'        => ['nullable', 'string', 'max:500'],
        ]);

        $oldProgramId = $student->program_id;

        // If same program, no-op
        if ((int) $oldProgramId === (int) $validated['new_program_id']) {
            return response()->json(['message' => 'Student is already in this program.'], 422);
        }

        $archivedCount = 0;
        DB::transaction(function () use ($student, $validated, $oldProgramId, &$archivedCount, $user) {
            // Archive all active enrollments from the old program
            if ($oldProgramId) {
                $oldCurriculumSubjectIds = Curriculum::where('program_id', $oldProgramId)
                    ->pluck('subject_id')
                    ->toArray();

                $archivedCount = Enrollment::where('student_id', $student->student_id)
                    ->whereIn('subject_id', $oldCurriculumSubjectIds)
                    ->whereIn('status', ['enrolled'])
                    ->update(['status' => 'archived']);
            }

            // Update student's active program
            $student->program_id = $validated['new_program_id'];
            $student->save();

            // Log the program change
            ProgramChangeLog::create([
                'student_id'                  => $student->student_id,
                'old_program_id'              => $oldProgramId,
                'new_program_id'              => $validated['new_program_id'],
                'reason'                      => $validated['reason'],
                'remarks'                     => $validated['remarks'] ?? null,
                'changed_by'                  => $user->id,
                'affected_enrollments_archived' => $archivedCount,
            ]);

            SystemLog::create([
                'action'  => 'Student program changed',
                'user_id' => $user->id,
                'role'    => $user->roles->first()?->name ?? $user->role ?? null,
            ]);
        });

        $student->refresh();
        return response()->json([
            'message'           => 'Program updated successfully.',
            'student'           => $student->load('program'),
            'archived_count'    => $archivedCount,
        ]);
    }

    /**
     * List subjects under a specific program curriculum.
     * Optional query params: year_level (int), semester (1 or 2).
     */
    public function programSubjects(int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles(request()->user(), ['staff', 'admin'])) {
            return $err;
        }

        $query = Curriculum::with('subject')
            ->where('program_id', $id)
            ->orderBy('year_level')
            ->orderBy('semester');

        if ($yearLevel = request()->input('year_level')) {
            $query->where('year_level', (int) $yearLevel);
        }
        if ($semester = request()->input('semester')) {
            $semesterMap = ['1st' => 1, '2nd' => 2];
            $semInt = is_numeric($semester) ? (int) $semester : ($semesterMap[$semester] ?? null);
            if ($semInt) {
                $query->where('semester', $semInt);
            }
        }

        $curriculum = $query->get();

        return response()->json(['curriculum' => $curriculum]);
    }

    /**
     * List subjects for dropdowns (staff/admin). Per thesis: subject code, title, units.
     */
    public function subjects(): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles(request()->user(), ['staff', 'admin'])) {
            return $err;
        }
        $subjects = Subject::orderBy('code')->get(['id', 'code', 'title', 'units']);
        return response()->json(['subjects' => $subjects]);
    }

    /**
     * Store enrollment for a student.
     * Fixed: per-subject duplicate check (ignores soft-deleted), additive to existing semester groups.
     */
    public function storeEnrollment(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }
        $student = Student::find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        // Student must already have an active program
        if (! $student->program_id) {
            return response()->json(['message' => 'Student has no active program set. Please set a program first.'], 422);
        }

        $validated = $request->validate([
            'academic_year' => ['required', 'string', 'max:20'],
            'semester'      => ['required', 'string', 'max:20'],
            'status'        => ['nullable', 'string', 'max:20', 'in:enrolled,completed,dropped'],
            'year_level'    => ['required', 'integer', 'min:1', 'max:4'],
            'subject_ids'   => ['nullable', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
        ], [
            'academic_year.required' => 'Academic year is required.',
            'semester.required'      => 'Semester is required.',
            'year_level.required'    => 'Year level is required.',
        ]);

        $programId   = $student->program_id;
        $studentId   = $student->student_id;
        $academicYear = $validated['academic_year'];
        $statusVal    = $validated['status'] ?? 'enrolled';
        $yearLevel    = $validated['year_level'];

        $SEMESTER_MAPPING = ['1st' => 1, '2nd' => 2];
        $semesterInt = $SEMESTER_MAPPING[$validated['semester']] ?? 1;

        // Validate subjects belong to program/year/semester
        if (!empty($validated['subject_ids'])) {
            $validSubjectIds = Curriculum::where('program_id', $programId)
                ->where('year_level', $yearLevel)
                ->where('semester', $semesterInt)
                ->pluck('subject_id')
                ->toArray();

            $invalidIds = array_diff($validated['subject_ids'], $validSubjectIds);
            if (!empty($invalidIds)) {
                return response()->json([
                    'message' => 'Some subjects do not belong to the student\'s active program curriculum for the selected year and semester.',
                    'errors'  => ['subject_ids' => ['Invalid subjects for this program/year/semester.']],
                ], 422);
            }
            $subjectsToEnroll = $validated['subject_ids'];
        } else {
            $subjectsToEnroll = Curriculum::where('program_id', $programId)
                ->where('year_level', $yearLevel)
                ->where('semester', $semesterInt)
                ->pluck('subject_id')
                ->toArray();
        }

        if (empty($subjectsToEnroll)) {
            return response()->json(['message' => 'No subjects found for the selected program, year level, and semester.'], 422);
        }

        // Per-subject duplicate check: only active (non-soft-deleted) enrollments count.
        // This allows re-adding subjects that were previously archived/soft-deleted.
        $duplicateSubjects = [];
        $enrolledCount = 0;

        DB::transaction(function () use (
            $subjectsToEnroll, $studentId, $programId, $academicYear, $semesterInt,
            $statusVal, $yearLevel, &$duplicateSubjects, &$enrolledCount
        ) {
            foreach ($subjectsToEnroll as $subjectId) {
                // Only count non-deleted active enrollments as duplicates
                $activeExists = Enrollment::where('student_id', $studentId)
                    ->where('subject_id', $subjectId)
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semesterInt)
                    ->whereNotIn('status', ['archived', 'dropped'])
                    ->whereNull('deleted_at')
                    ->exists();

                if ($activeExists) {
                    $duplicateSubjects[] = $subjectId;
                    continue; // skip this one, don't fail the whole batch
                }

                Enrollment::create([
                    'student_id'    => $studentId,
                    'subject_id'    => $subjectId,
                    'academic_year' => $academicYear,
                    'semester'      => $semesterInt,
                    'status'        => 'enrolled',
                ]);
                $enrolledCount++;
            }

            // Upsert the ProgramMapping (semester group tracker).
            // If one already exists (from a prior additive enrollment), just update it.
            // This prevents the old block that rejected the whole batch.
            ProgramMapping::updateOrCreate(
                [
                    'student_id'    => $studentId,
                    'program_id'    => $programId,
                    'academic_year' => $academicYear,
                    'semester'      => $semesterInt,
                ],
                [
                    'status'     => $statusVal,
                    'year_level' => $yearLevel,
                ]
            );
        });

        if ($enrolledCount === 0 && !empty($duplicateSubjects)) {
            // Every subject was already actively enrolled
            return response()->json([
                'message' => 'All selected subjects are already actively enrolled for this student in the selected academic year and semester.',
                'errors'  => ['subject_ids' => ['All selected subjects are duplicate active enrollments.']],
                'duplicate_subject_ids' => $duplicateSubjects,
            ], 422);
        }

        SystemLog::create([
            'action'  => 'Enrollment added',
            'user_id' => $request->user()->id,
            'role'    => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);

        $responseMsg = "Enrollment added successfully. {$enrolledCount} subject(s) enrolled.";
        if (!empty($duplicateSubjects)) {
            $responseMsg .= ' ' . count($duplicateSubjects) . ' subject(s) were already actively enrolled and skipped.';
        }

        return response()->json([
            'message'               => $responseMsg,
            'enrolled_count'        => $enrolledCount,
            'skipped_duplicates'    => count($duplicateSubjects),
            'duplicate_subject_ids' => $duplicateSubjects,
        ], 201);
    }

    /**
     * Update an enrollment (staff/admin).
     */
    public function updateEnrollment(Request $request, int $id, int $enrollmentId): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }
        $enrollment = Enrollment::where('student_id', $id)->where('id', $enrollmentId)->first();
        if (! $enrollment) {
            return response()->json(['message' => 'Enrollment not found.'], 404);
        }
        $validated = $request->validate([
            'academic_year' => ['sometimes', 'required', 'string', 'max:20'],
            'semester' => ['sometimes', 'required', 'string', 'max:20'],
            'status' => ['nullable', 'string', 'max:20', 'in:enrolled,completed,dropped'],
        ]);
        $enrollment->update($validated);
        $enrollment->load('subject');
        SystemLog::create([
            'action' => 'Enrollment updated',
            'user_id' => $request->user()->id,
            'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);
        return response()->json(['message' => 'Enrollment updated.', 'enrollment' => $enrollment]);
    }

    /**
     * Archive (soft-delete) a single subject enrollment.
     * - Checks for existing grade and warns frontend.
     * - Uses soft delete to preserve history.
     * - Writes enrollment audit log.
     * - Cleans up ProgramMapping if no more active subjects remain in that semester group.
     */
    public function destroyEnrollment(Request $request, int $id, int $enrollmentId): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        // Fetch only non-deleted enrollment belonging to this student
        $enrollment = Enrollment::where('student_id', $id)
            ->where('id', $enrollmentId)
            ->whereNull('deleted_at')
            ->first();

        if (! $enrollment) {
            return response()->json(['message' => 'Enrollment not found or already removed.'], 404);
        }

        $user      = $request->user();
        $confirmed = filter_var($request->input('confirmed', false), FILTER_VALIDATE_BOOLEAN);
        $reason    = $request->input('reason', null);

        // Check if this enrollment has a grade
        $grade = Grade::where('student_id', $id)
            ->where('subject_id', $enrollment->subject_id)
            ->where('academic_year', $enrollment->academic_year)
            ->where('semester', $enrollment->semester)
            ->first();

        $hasGrade = !is_null($grade);

        // If grade exists and not yet confirmed by frontend, return a warning
        if ($hasGrade && !$confirmed) {
            return response()->json([
                'message'   => 'This subject already has a recorded grade. Removing it will archive the enrollment but preserve the grade for historical records. Continue?',
                'has_grade' => true,
                'requires_confirmation' => true,
                'grade_value' => $grade->grade_value,
            ], 409); // 409 Conflict = requires user decision
        }

        $oldStatus = $enrollment->status;

        DB::transaction(function () use ($enrollment, $user, $reason, $hasGrade) {
            // Soft-delete the enrollment (sets deleted_at)
            $enrollment->deleted_by   = $user->id;
            $enrollment->delete_reason = $reason;
            $enrollment->save();
            $enrollment->delete(); // triggers SoftDelete (sets deleted_at)

            // Write audit log
            EnrollmentAuditLog::create([
                'student_id'    => $enrollment->student_id,
                'enrollment_id' => $enrollment->id,
                'subject_id'    => $enrollment->subject_id,
                'academic_year' => $enrollment->academic_year,
                'semester'      => $enrollment->semester,
                'old_status'    => $enrollment->status,
                'new_status'    => 'archived',
                'changed_by'    => $user->id,
                'action'        => 'archived',
                'reason'        => $reason,
                'had_grade'     => $hasGrade,
            ]);

            // --- Clean up ProgramMapping if this was the last active subject in the semester group ---
            $remainingActive = Enrollment::where('student_id', $enrollment->student_id)
                ->where('academic_year', $enrollment->academic_year)
                ->where('semester', $enrollment->semester)
                ->whereNull('deleted_at')  // exclude soft-deleted
                ->whereNotIn('status', ['archived', 'dropped'])
                ->count();

            if ($remainingActive === 0) {
                // Archive the ProgramMapping so it doesn't block future enrollments
                ProgramMapping::where('student_id', $enrollment->student_id)
                    ->where('academic_year', $enrollment->academic_year)
                    ->where('semester', $enrollment->semester)
                    ->update(['status' => 'archived']);
            }
        });

        SystemLog::create([
            'action'  => 'Enrollment removed',
            'user_id' => $user->id,
            'role'    => $user->roles->first()?->name ?? $user->role ?? null,
        ]);

        return response()->json([
            'message'   => 'Subject enrollment removed successfully.',
            'has_grade' => $hasGrade,
            'archived'  => true,
        ]);
    }

    /**
     * Store grade for a student. Required: subject_id, academic_year, semester. Optional: grade_value, remarks.
     */
    public function storeGrade(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }
        $student = Student::find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        $validated = $request->validate([
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'academic_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'string', 'max:20'],
            'grade_value' => ['nullable', 'numeric', 'min:0', 'max:5.00'],
            'remarks' => ['nullable', 'string', 'max:50'],
        ], [
            'subject_id.required' => 'Subject is required.',
            'academic_year.required' => 'Academic year is required.',
            'semester.required' => 'Semester is required.',
        ]);
        $validated['student_id'] = $student->student_id;
        if (isset($validated['grade_value'])) {
            $validated['grade_value'] = round((float) $validated['grade_value'], 2);
        }
        $exists = Grade::where('student_id', $student->student_id)
            ->where('subject_id', $validated['subject_id'])
            ->where('academic_year', $validated['academic_year'])
            ->where('semester', $validated['semester'])
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'A grade already exists for this subject, academic year, and semester.', 'errors' => ['subject_id' => ['Duplicate grade.']]], 422);
        }
        $grade = Grade::create($validated);
        $grade->load('subject');
        SystemLog::create([
            'action' => 'Grade added',
            'user_id' => $request->user()->id,
            'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);
        return response()->json(['message' => 'Grade added.', 'grade' => $grade], 201);
    }

    /**
     * Update a grade (staff/admin).
     */
    public function updateGrade(Request $request, int $id, int $gradeId): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }
        $grade = Grade::where('student_id', $id)->where('id', $gradeId)->first();
        if (! $grade) {
            return response()->json(['message' => 'Grade not found.'], 404);
        }
        $validated = $request->validate([
            'academic_year' => ['sometimes', 'required', 'string', 'max:20'],
            'semester' => ['sometimes', 'required', 'string', 'max:20'],
            'grade_value' => ['nullable', 'numeric', 'min:0', 'max:5.00'],
            'remarks' => ['nullable', 'string', 'max:50'],
        ]);
        if (array_key_exists('grade_value', $validated) && $validated['grade_value'] !== null) {
            $validated['grade_value'] = round((float) $validated['grade_value'], 2);
        }
        $grade->update($validated);
        $grade->load('subject');
        SystemLog::create([
            'action' => 'Grade updated',
            'user_id' => $request->user()->id,
            'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);
        return response()->json(['message' => 'Grade updated.', 'grade' => $grade]);
    }

    /**
     * Delete a grade (staff/admin).
     */
    public function destroyGrade(Request $request, int $id, int $gradeId): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }
        $grade = Grade::where('student_id', $id)->where('id', $gradeId)->first();
        if (! $grade) {
            return response()->json(['message' => 'Grade not found.'], 404);
        }
        $grade->delete();
        SystemLog::create([
            'action' => 'Grade removed',
            'user_id' => $request->user()->id,
            'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);
        return response()->json(['message' => 'Grade removed.']);
    }

    /*
     *  Archive a student
    */
    public function archiveStudent(Request $request, int $id): JsonResponse
    {
        try {
            if ($err = $this->requireAuth()) {
                return $err;
            }
            if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
                return $err;
            }
            $student = Student::find($id);
            if (! $student) {
                return response()->json(['message' => 'Student not found.'], 404);
            }
            $archiveRecord = ArchiveRecord::create([
                'student_id' => $student->student_id,
                'record_type' => $request->input('record_type'),
                'cabinet_no' => $request->input('cabinet_no'),
                'shelf_no' => $request->input('shelf_no'),
                'folder_code' => $request->input('folder_code'),
                'document_status' => $request->input('document_status'),
            ]);
            if (!$archiveRecord) {
                return response()->json(['message' => 'Failed to create archive record.'], 500);
            }
            SystemLog::create([
                'action' => 'Student archived',
                'user_id' => $request->user()->id,
                'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
            ]);
            return response()->json(['message' => 'Student archived successfully.']);
        } catch (\Exception $e) {
            Log::error('Failed to archive student: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to archive student.'], 500);
        }
    }
}
