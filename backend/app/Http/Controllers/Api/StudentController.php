<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Http\Requests\StoreStudentRequest;
use App\Http\Requests\UpdateStudentRequest;
use App\Models\ArchiveRecord;
use App\Models\Curriculum;
use App\Services\OfficialTranscriptExportService;
use App\Services\AcademicProgressionService;
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

            ArchiveRecord::create([
                'student_id'      => $student->student_id,
                'record_type'     => $validated['record_type'],
                'cabinet_no'      => $validated['cabinet_no'],
                'shelf_no'        => $validated['shelf_no'],
                'folder_code'     => $validated['folder_code'],
                'document_status' => $validated['document_status'],
            ]);

            return $student;
        });

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


        $studentNumber = $validated['student_number'];
        $name = trim($validated['first_name'] . ' ' . $validated['last_name']);
        $email = $validated['email'];

        $trackFields = [
            'student_number', 'first_name', 'last_name', 'middle_name',
            'date_of_birth', 'sex', 'email', 'contact_number', 'address',
            'enrollment_date', 'graduation_date',
        ];
        $oldValues = [];
        foreach ($trackFields as $field) {
            $oldValues[$field] = $student->getAttribute($field);
        }

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

        $changed = [];
        foreach ($trackFields as $field) {
            $newVal = $validated[$field] ?? null;
            $oldVal = $oldValues[$field] ?? '';
            
            // Format Carbon date objects to YYYY-MM-DD so they match the frontend payload
            if ($oldVal instanceof \Carbon\Carbon || $oldVal instanceof \Illuminate\Support\Carbon) {
                $oldVal = $oldVal->format('Y-m-d');
            }

            if ((string) $oldVal !== (string) ($newVal ?? '')) {
                $changed[] = str_replace('_', ' ', $field);
            }
        }

        $changedStr = $changed ? implode(', ', $changed) : 'no changes';
        $ip         = $request->ip();

        SystemLog::create([
            'action'  => "Student {$studentNumber} ({$name}) record updated by staff — fields: {$changedStr} [IP: {$ip}]",
            'user_id' => $user->id,
            'role'    => $role,
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

        $query = Curriculum::with(['subject', 'prerequisite'])
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

        // ── Prerequisite validation ───────────────────────────────────────────
        // For every subject being enrolled, if the curriculum entry declares a
        // prerequisite the student must already have a passing grade in it.
        // No same-batch bypass: enrolling prereq + dependent together is blocked.
        $prereqEntries = Curriculum::with(['subject', 'prerequisites'])
            ->where('program_id', $programId)
            ->whereIn('subject_id', $subjectsToEnroll)
            ->get();

        $prereqEntries = $prereqEntries->filter(function ($entry) {
            return $entry->prerequisites->isNotEmpty();
        });

        if ($prereqEntries->isNotEmpty()) {
            $passedSubjectIds = Grade::where('student_id', $studentId)
                ->where(function ($q) {
                    $q->where(function ($inner) {
                        $inner->whereNotNull('grade_value')
                              ->where('grade_value', '>=', 1.00)
                              ->where('grade_value', '<=', 3.00);
                    })->orWhere(function ($inner) {
                        $inner->whereNull('grade_value')
                              ->where('remarks', 'PASSED');
                    });
                })
                ->pluck('subject_id')
                ->toArray();

            $prereqErrors = [];
            foreach ($prereqEntries as $entry) {
                $requiredPrereqIds = $entry->prerequisites->pluck('id')->toArray();
                $missingIds = array_diff($requiredPrereqIds, $passedSubjectIds);

                if (!empty($missingIds)) {
                    $missingCodes = [];
                    foreach ($entry->prerequisites as $prereqSubject) {
                        if (in_array($prereqSubject->id, $missingIds)) {
                            $missingCodes[] = $prereqSubject->code;
                        }
                    }
                    $missingDisplay = implode(', ', $missingCodes);
                    $currentCode = $entry->subject?->code ?? "Subject #{$entry->subject_id}";
                    $prereqErrors[] = "{$missingDisplay} must be completed before enrolling in {$currentCode}.";
                }
            }

            if (! empty($prereqErrors)) {
                return response()->json([
                    'message' => 'Enrollment failed: prerequisite requirements not met.',
                    'errors'  => ['prerequisites' => $prereqErrors],
                ], 422);
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // Per-subject duplicate check: only active (non-soft-deleted) enrollments count.
        // This allows re-adding subjects that were previously archived/soft-deleted.
        $duplicateSubjects = [];
        $enrolledCount = 0;

        DB::transaction(function () use (
            $subjectsToEnroll, $studentId, $programId, $academicYear, $semesterInt,
            $statusVal, $yearLevel, &$duplicateSubjects, &$enrolledCount
        ) {
            foreach ($subjectsToEnroll as $subjectId) {
                // Must not be already passed/credited
                if (in_array($subjectId, $passedSubjectIds)) {
                    $duplicateSubjects[] = $subjectId;
                    continue;
                }

                // Check for active enrollment in ANY term, not just the selected one
                $activeExists = Enrollment::where('student_id', $studentId)
                    ->where('subject_id', $subjectId)
                    ->whereNotIn('status', [
                        'archived', 'Archived', 
                        'cancelled', 'Cancelled', 
                        'failed', 'Failed', 
                        'withdrawn', 'Withdrawn', 
                        'fda', 'FDA',
                        'dropped', 'Dropped'
                    ])
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

        $user   = $request->user();
        $reason = $request->input('reason', null);

        // Check if this enrollment has a grade with final status
        $grade = Grade::where('student_id', $id)
            ->where('subject_id', $enrollment->subject_id)
            ->where('academic_year', $enrollment->academic_year)
            ->where('semester', $enrollment->semester)
            ->first();

        $hasFinalStatus = false;
        if ($grade) {
            $finalStatuses = ['Passed', 'Failed', 'INC', 'Withdrawn', 'FDA', 'Credited'];
            if ($grade->status && in_array($grade->status, $finalStatuses)) {
                $hasFinalStatus = true;
            } elseif ($grade->grade_value !== null && $grade->grade_value > 0) {
                $hasFinalStatus = true;
            } elseif ($grade->remarks && in_array(strtoupper($grade->remarks), ['PASSED', 'FAILED', 'INC', 'WITHDRAWN', 'FDA', 'CREDITED'])) {
                $hasFinalStatus = true;
            }
        }

        // Block deletion if enrollment has a grade with final status
        if ($hasFinalStatus) {
            return response()->json([
                'message' => 'This enrollment already has a grade or final status. Use correction workflow instead of deleting finalized academic history.',
                'has_final_status' => true,
                'grade_value' => $grade?->grade_value,
                'grade_status' => $grade?->status ?? $grade?->remarks,
            ], 422);
        }

        // No final grade — allow cancellation
        if (!$reason) {
            return response()->json([
                'message' => 'A reason is required to cancel an enrollment.',
                'requires_reason' => true,
            ], 422);
        }

        DB::transaction(function () use ($enrollment, $user, $reason, $grade) {
            $oldStatus = $enrollment->status;

            // Update status to Cancelled and soft-delete
            $enrollment->status = 'Cancelled';
            $enrollment->deleted_by   = $user->id;
            $enrollment->delete_reason = $reason;
            $enrollment->save();
            $enrollment->delete(); // triggers SoftDelete

            // Also remove the placeholder grade if it exists and has no value
            if ($grade && $grade->grade_value === null && (!$grade->status || $grade->status === 'Enrolled')) {
                $grade->delete();
            }

            // Write audit log
            EnrollmentAuditLog::create([
                'student_id'    => $enrollment->student_id,
                'enrollment_id' => $enrollment->id,
                'subject_id'    => $enrollment->subject_id,
                'academic_year' => $enrollment->academic_year,
                'semester'      => $enrollment->semester,
                'old_status'    => $oldStatus,
                'new_status'    => 'Cancelled',
                'changed_by'    => $user->id,
                'action'        => 'cancelled',
                'reason'        => $reason,
                'had_grade'     => !is_null($grade),
                'user_role'     => $user->roles->first()?->name ?? $user->role ?? null,
            ]);

            // Clean up ProgramMapping if last active subject in semester group
            $remainingActive = Enrollment::where('student_id', $enrollment->student_id)
                ->where('academic_year', $enrollment->academic_year)
                ->where('semester', $enrollment->semester)
                ->whereNull('deleted_at')
                ->whereNotIn('status', ['archived', 'Cancelled'])
                ->count();

            if ($remainingActive === 0) {
                ProgramMapping::where('student_id', $enrollment->student_id)
                    ->where('academic_year', $enrollment->academic_year)
                    ->where('semester', $enrollment->semester)
                    ->update(['status' => 'archived']);
            }
        });

        SystemLog::create([
            'action'  => 'Enrollment cancelled',
            'user_id' => $user->id,
            'role'    => $user->roles->first()?->name ?? $user->role ?? null,
        ]);

        return response()->json([
            'message'  => 'Enrollment cancelled successfully.',
            'archived' => true,
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
        
        // Recalculate GWA
        $student = Student::find($id);
        if ($student) {
            $standingService = app(\App\Services\AcademicStandingService::class);
            $standingService->recomputeAndCacheOverallGwa($student);
        }

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
        
        // Recalculate GWA
        $student = Student::find($id);
        if ($student) {
            $standingService = app(\App\Services\AcademicStandingService::class);
            $standingService->recomputeAndCacheOverallGwa($student);
        }

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

        // Recalculate GWA
        $student = Student::find($id);
        if ($student) {
            $standingService = app(\App\Services\AcademicStandingService::class);
            $standingService->recomputeAndCacheOverallGwa($student);
        }

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

    // ═══════════════════════════════════════════════════════════════════════
    // Academic Progression Endpoints
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * GET /api/staff/students/{id}/academic-progress
     * Returns full academic progression state for a student.
     */
    public function academicProgress(int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles(request()->user(), ['staff', 'admin'])) {
            return $err;
        }

        $student = Student::with('program')->find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $service = app(AcademicProgressionService::class);
        $progress = $service->getAcademicProgress($student);

        return response()->json($progress);
    }

    /**
     * GET /api/staff/students/{id}/academic-summary
     * Returns full academic summary including GWA, GPAs, and Honors eligibility.
     */
    public function academicSummary(int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles(request()->user(), ['staff', 'admin'])) {
            return $err;
        }

        $student = Student::find($id);
        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $student->load('program');

        $standingService = app(\App\Services\AcademicStandingService::class);
        $progressionService = app(\App\Services\AcademicProgressionService::class);

        $summary = $standingService->getAcademicSummary($student);
        $roadmapData = $progressionService->getCurriculumRoadmap($student);

        // Compute Notifications (similar to student side, just in case staff needs it)
        $notifications = [];
        
        if ($summary['latin_honors']['eligible']) {
            $notifications[] = [
                'type' => 'success',
                'message' => 'Student is currently eligible for Latin Honors: ' . $summary['latin_honors']['honor']
            ];
        }
        
        if ($roadmapData['failed_subjects_count'] > 0) {
            $notifications[] = [
                'type' => 'warning',
                'message' => 'Student has ' . $roadmapData['failed_subjects_count'] . ' failed subject(s) that require a retake.'
            ];
        }

        return response()->json([
            'student' => [
                'student_number' => $student->student_number,
                'name' => trim($student->first_name . ' ' . $student->last_name),
                'program' => $student->program?->name,
                'program_code' => $student->program?->code,
                'enrollment_date' => $student->enrollment_date,
            ],
            'summary' => $summary,
            'curriculum' => $roadmapData,
            'notifications' => $notifications
        ]);
    }

    /**
     * POST /api/staff/students/{id}/enrollments/add-next-term
     * Add enrollment for the next allowed term. Backend computes everything.
     */
    public function addNextTerm(Request $request, int $id): JsonResponse
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

        if (! $student->program_id) {
            return response()->json(['message' => 'Student has no active program. Set a program first.'], 422);
        }

        $validated = $request->validate([
            // Regular next-term subjects (optional if only retaking)
            'subject_ids'     => ['nullable', 'array'],
            'subject_ids.*'   => ['integer', 'exists:subjects,id'],
            // Retake subjects (previously Failed/Withdrawn/FDA)
            'retake_subject_ids'   => ['nullable', 'array'],
            'retake_subject_ids.*' => ['integer', 'exists:subjects,id'],
        ]);

        $subjectIds      = $validated['subject_ids'] ?? [];
        $retakeSubjectIds = $validated['retake_subject_ids'] ?? [];

        // At least one subject must be selected (regular or retake)
        if (empty($subjectIds) && empty($retakeSubjectIds)) {
            return response()->json([
                'message' => 'Enrollment validation failed.',
                'errors'  => ['validation' => ['Select at least one regular or retake subject to enroll.']],
            ], 422);
        }

        $service = app(AcademicProgressionService::class);
        $result  = $service->validateAddNextTerm($student, $subjectIds, $retakeSubjectIds);

        if (!$result['valid']) {
            return response()->json([
                'message' => 'Enrollment validation failed.',
                'errors'  => ['validation' => $result['errors']],
            ], 422);
        }

        // ── Academic load validation ──────────────────────────────────────────
        // Must run after subject/retake validation so we work with the clean
        // validated ID lists, not the raw frontend input.
        $allSelectedIds    = array_merge($result['data']['subject_ids'], $result['data']['retake_ids']);
        $loadService       = app(\App\Services\AcademicLoadValidationService::class);
        $validatedNextTerm = [
            'can_add'       => true,
            'year_level'    => $result['data']['year_level'],
            'semester'      => (int) $result['data']['semester'],
            'academic_year' => $result['data']['academic_year'],
        ];
        $maxEligible = $loadService->computeMaxEligibleUnits($student, $validatedNextTerm);
        $loadCheck   = $loadService->validate($allSelectedIds, $maxEligible);

        if (!$loadCheck['is_valid_load']) {
            return response()->json([
                'message'         => 'Enrollment failed: ' . $loadCheck['message'],
                'errors'          => ['load' => [$loadCheck['message']]],
                'load_validation' => $loadCheck,
            ], 422);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Residency is enforced by validateAddNextTerm() above via
        // computeNextAllowedTerm(). No separate residency call is needed here.

        $data          = $result['data'];
        $user          = $request->user();
        $role          = $user->roles->first()?->name ?? $user->role ?? null;
        $enrolledCount = 0;
        $retakeCount   = 0;

        DB::transaction(function () use ($student, $data, $user, $role, &$enrolledCount, &$retakeCount) {

            // ── Regular subjects ──────────────────────────────────────────────
            foreach ($data['subject_ids'] as $subjectId) {
                $enrollment = Enrollment::create([
                    'student_id'    => $student->student_id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'year_level'    => $data['year_level'],
                    'status'        => 'Enrolled',
                    'is_retake'     => false,
                ]);

                Grade::create([
                    'student_id'    => $student->student_id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'enrollment_id' => $enrollment->id,
                    'status'        => 'Enrolled',
                    'grade_value'   => null,
                    'remarks'       => null,
                ]);

                EnrollmentAuditLog::create([
                    'student_id'    => $student->student_id,
                    'enrollment_id' => $enrollment->id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'old_status'    => null,
                    'new_status'    => 'Enrolled',
                    'changed_by'    => $user->id,
                    'action'        => 'enrollment_created',
                    'reason'        => null,
                    'had_grade'     => false,
                    'user_role'     => $role,
                ]);

                $enrolledCount++;
            }

            // ── Retake subjects ───────────────────────────────────────────────
            foreach ($data['retake_ids'] as $subjectId) {
                $enrollment = Enrollment::create([
                    'student_id'    => $student->student_id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'year_level'    => $data['year_level'],
                    'status'        => 'Enrolled',
                    'is_retake'     => true,
                ]);

                Grade::create([
                    'student_id'    => $student->student_id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'enrollment_id' => $enrollment->id,
                    'status'        => 'Enrolled',
                    'grade_value'   => null,
                    'remarks'       => null,
                ]);

                EnrollmentAuditLog::create([
                    'student_id'    => $student->student_id,
                    'enrollment_id' => $enrollment->id,
                    'subject_id'    => $subjectId,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                    'old_status'    => null,
                    'new_status'    => 'Enrolled',
                    'changed_by'    => $user->id,
                    'action'        => 'retake_enrollment_created',
                    'reason'        => 'Retake of previously Failed/Withdrawn/FDA attempt.',
                    'had_grade'     => false,
                    'user_role'     => $role,
                ]);

                $retakeCount++;
            }

            // ── Upsert ProgramMapping ─────────────────────────────────────────
            ProgramMapping::updateOrCreate(
                [
                    'student_id'    => $student->student_id,
                    'program_id'    => $student->program_id,
                    'academic_year' => $data['academic_year'],
                    'semester'      => $data['semester'],
                ],
                [
                    'status'     => 'enrolled',
                    'year_level' => $data['year_level'],
                ]
            );
        });

        $total = $enrolledCount + $retakeCount;
        
        $studentName = trim($student->first_name . ' ' . $student->last_name);
        $studentIdent = $student->student_number ? "{$student->student_number} ({$studentName})" : $studentName;

        SystemLog::create([
            'action'  => "Added {$enrolledCount} enrollment(s) and {$retakeCount} retake(s) for student {$studentIdent} - Year {$data['year_level']} Sem {$data['semester']} A.Y. {$data['academic_year']}",
            'user_id' => $user->id,
            'role'    => $role,
        ]);

        $student->refresh();
        $progress = $service->getAcademicProgress($student);

        return response()->json([
            'message'        => "{$total} subject(s) enrolled successfully for Year {$data['year_level']}, Semester {$data['semester']}, A.Y. {$data['academic_year']} ({$enrolledCount} new, {$retakeCount} retake).",
            'enrolled_count' => $enrolledCount,
            'retake_count'   => $retakeCount,
            'progress'       => $progress,
        ], 201);
    }


    /**
     * PUT /api/staff/students/{id}/grades/bulk-update
     * Bulk update grades for enrolled subjects.
     */
    public function bulkUpdateGrades(Request $request, int $id): JsonResponse
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
            'grades'                                => ['required', 'array', 'min:1'],
            'grades.*.grade_id'                     => ['required', 'integer', 'exists:grades,id'],
            'grades.*.grade_value'                  => ['nullable', 'numeric', 'min:0', 'max:5.00'],
            'grades.*.status'                       => ['nullable', 'string', 'in:Enrolled,Passed,Failed,INC,Withdrawn,FDA,Credited,DRP,CON'],
            'grades.*.remarks'                      => ['nullable', 'string', 'max:50'],
            'grades.*.supporting_document_reference' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $role = $user->roles->first()?->name ?? $user->role ?? null;
        $service = app(AcademicProgressionService::class);
        $errors = [];
        $updatedCount = 0;

        DB::transaction(function () use ($validated, $student, $user, $role, $service, &$errors, &$updatedCount) {
            foreach ($validated['grades'] as $index => $gradeData) {
                $grade = Grade::where('id', $gradeData['grade_id'])
                    ->where('student_id', $student->student_id)
                    ->first();

                if (!$grade) {
                    $errors[] = "Grade #{$gradeData['grade_id']} not found for this student.";
                    continue;
                }

                $gradeValue = isset($gradeData['grade_value']) && $gradeData['grade_value'] !== null && $gradeData['grade_value'] !== ''
                    ? round((float) $gradeData['grade_value'], 2)
                    : null;

                $explicitStatus = $gradeData['status'] ?? null;

                // Auto-determine status from grade value if not explicitly set
                $newStatus = $service->autoStatusFromGrade($gradeValue, $explicitStatus);

                // Auto-generate remarks
                $remarks = !empty($gradeData['remarks'])
                    ? $gradeData['remarks']
                    : $service->autoGenerateRemarks($gradeValue, $newStatus);

                // Validate: Credited requires supporting document
                if ($newStatus === 'Credited' && empty($gradeData['supporting_document_reference'])) {
                    $errors[] = "Grade #{$gradeData['grade_id']}: Credited status requires a supporting document reference.";
                    continue;
                }

                // Track old values for audit
                $oldValue = json_encode([
                    'grade_value' => $grade->grade_value,
                    'status'      => $grade->status,
                    'remarks'     => $grade->remarks,
                ]);

                // Handle INC → Passed conversion
                $convertedFrom = null;
                $convertedAt = null;
                if ($grade->status === 'INC' && $newStatus === 'Passed') {
                    $convertedFrom = 'INC';
                    $convertedAt = now();
                }

                // Update the grade
                $grade->update([
                    'grade_value'                  => $gradeValue,
                    'status'                       => $newStatus,
                    'remarks'                      => $remarks,
                    'supporting_document_reference' => $gradeData['supporting_document_reference'] ?? $grade->supporting_document_reference,
                    'converted_from_status'        => $convertedFrom ?? $grade->converted_from_status,
                    'converted_at'                 => $convertedAt ?? $grade->converted_at,
                ]);

                // Update enrollment status to match
                if ($grade->enrollment_id) {
                    Enrollment::where('id', $grade->enrollment_id)->update(['status' => $newStatus]);
                } else {
                    // Link by matching fields
                    Enrollment::where('student_id', $student->student_id)
                        ->where('subject_id', $grade->subject_id)
                        ->where('academic_year', $grade->academic_year)
                        ->where('semester', $grade->semester)
                        ->whereNull('deleted_at')
                        ->update(['status' => $newStatus]);
                }

                // Audit log
                $newValue = json_encode([
                    'grade_value' => $gradeValue,
                    'status'      => $newStatus,
                    'remarks'     => $remarks,
                ]);

                $action = 'grade_updated';
                if ($convertedFrom === 'INC') {
                    $action = 'inc_to_passed';
                } elseif ($newStatus === 'Credited') {
                    $action = 'marked_credited';
                }

                EnrollmentAuditLog::create([
                    'student_id'                    => $student->student_id,
                    'enrollment_id'                 => $grade->enrollment_id ?? 0,
                    'subject_id'                    => $grade->subject_id,
                    'academic_year'                 => $grade->academic_year,
                    'semester'                      => $grade->semester,
                    'old_status'                    => $grade->getOriginal('status'),
                    'new_status'                    => $newStatus,
                    'changed_by'                    => $user->id,
                    'action'                        => $action,
                    'reason'                        => null,
                    'had_grade'                     => true,
                    'old_value'                     => $oldValue,
                    'new_value'                     => $newValue,
                    'supporting_document_reference' => $gradeData['supporting_document_reference'] ?? null,
                    'user_role'                     => $role,
                ]);

                $updatedCount++;
            }
        });

        if (!empty($errors) && $updatedCount === 0) {
            return response()->json([
                'message' => 'Grade update failed.',
                'errors'  => ['validation' => $errors],
            ], 422);
        }
        $studentName = trim($student->first_name . ' ' . $student->last_name);
        $studentIdent = $student->student_number ? "{$student->student_number} ({$studentName})" : $studentName;

        SystemLog::create([
            'action'  => "Bulk updated {$updatedCount} grade(s) for student {$studentIdent}",
            'user_id' => $user->id,
            'role'    => $role,
        ]);

        try {
            // Return updated progress
            $student->refresh();
            
            // Recalculate GWA
            $standingService = app(\App\Services\AcademicStandingService::class);
            $standingService->recomputeAndCacheOverallGwa($student);

            $service = app(AcademicProgressionService::class);
            $progress = $service->getAcademicProgress($student);

            return response()->json([
                'message'       => "{$updatedCount} grade(s) updated successfully.",
                'updated_count' => $updatedCount,
                'errors'        => $errors,
                'progress'      => $progress,
            ]);
        } catch (\Exception $e) {
            \Log::error("bulkUpdateGrades Error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Exception after saving grades: ' . $e->getMessage()
            ], 500);
        }
    }
}
