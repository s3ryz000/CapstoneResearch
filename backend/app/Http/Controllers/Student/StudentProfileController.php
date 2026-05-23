<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Http\Requests\UpdateStudentSisRequest;
use App\Models\ProgramMapping;
use App\Models\SystemLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Student: profile, COR, subjects, grades, curriculum (own data only).
 */
class StudentProfileController extends Controller
{
    use AuthorizesRole;

    /**
     * Get authenticated student's profile (student record + program + user).
     */
    public function profile(Request $request): JsonResponse
    {
       try {
       
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $student->load('program');
        $student->load('programMappings.program');
        $academicYear = SystemSetting::getValue('academic_year') ?: date('Y') . '-' . (date('Y') + 1);
        $semester = SystemSetting::getValue('semester') ?: '2nd Semester';
        $semesterMapping  = [
            '2nd Semester' => 2,
            '1st Semester' => 1
        ];
        
        $programMapping = ProgramMapping::where('student_id',$student->student_id)->where('academic_year', $academicYear)->where('semester', $semesterMapping[$semester])->first();
       
        $service = app(\App\Services\AcademicStandingService::class);
        $summary = $service->getAcademicSummary($student);

        return response()->json([
            'student' => $student,
            'academic_year' => $academicYear,
            'program' => $programMapping?->program,
            'program_mapping' => $programMapping,
            'semester' => $semester,
            'institution_name' => SystemSetting::getValue('institution_name') ?: 'Trece Martires City College',
            'academic_summary' => $summary,
        ]);
       } catch (\Exception $e) {
        return response()->json([
            'message' => 'An error occurred while fetching the profile.',
            'error' => config('app.debug') ? $e->getMessage() : 'Something went wrong.',
        ], 500);
       }
    }

    /**
     * Certificate of Registration: enrolled subjects for the given or current term.
     */
    public function cor(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $academicYear = $request->input('academic_year') ?: (SystemSetting::getValue('academic_year') ?: date('Y') . '-' . (date('Y') + 1));
        $semester = $request->input('semester') ?: (SystemSetting::getValue('semester') ?: '2nd Semester');

        $enrollments = $student->enrollments()
            ->with('subject')
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'enrolled')
            ->get()
            ->sortBy(fn ($e) => $e->subject?->code ?? '')
            ->values();

        return response()->json([
            'academic_year' => $academicYear,
            'semester' => $semester,
            'student' => $student->load('program'),
            'enrollments' => $enrollments,
        ]);
    }

    /**
     * Enrolled subjects (all or filter by term).
     */
    public function subjects(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $query = $student->enrollments()->with('subject');
        if ($ay = $request->input('academic_year')) {
            $query->where('enrollments.academic_year', $ay);
        }
        if ($sem = $request->input('semester')) {
            $query->where('enrollments.semester', $sem);
        }
        $enrollments = $query->orderByDesc('enrollments.academic_year')->orderBy('enrollments.semester')->get();

        return response()->json(['enrollments' => $enrollments]);
    }

    /**
     * Grades (all or filter by term).
     */
    public function grades(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $query = $student->grades()->with('subject');
        if ($ay = $request->input('academic_year')) {
            $query->where('grades.academic_year', $ay);
        }
        if ($sem = $request->input('semester')) {
            $query->where('grades.semester', $sem);
        }
        $grades = $query->orderByDesc('grades.academic_year')->orderBy('grades.semester')->get()->sortBy(fn ($g) => $g->subject?->code ?? '')->values();

        return response()->json(['grades' => $grades]);
    }

    /**
     * Curriculum for the student's program (subjects by year level and semester).
     */
    public function curriculum(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $program = $student->program;
        if (! $program) {
            return response()->json([
                'program' => null,
                'curriculum' => [],
                'message' => 'No program assigned.',
            ]);
        }

        $curriculum = $program->curriculum()->with('subject')->orderBy('year_level')->orderBy('semester')->get();

        return response()->json([
            'program' => $program,
            'curriculum' => $curriculum,
        ]);
    }

    /**
     * Update authenticated student's SIS/SIUF fields (own record only).
     */
    public function updateSis(UpdateStudentSisRequest $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $validated = $request->validated();

        $fieldLabels = [
            'contact_number'    => 'contact number',
            'address'           => 'address',
            'place_of_birth'    => 'place of birth',
            'sex'               => 'sex',
            'guardian_name'     => 'guardian name',
            'citizenship'       => 'citizenship',
            'elementary_school' => 'elementary school',
            'elementary_year'   => 'elementary graduation year',
            'high_school'       => 'high school',
            'high_school_year'  => 'high school graduation year',
            'previous_school'   => 'previous school',
            'previous_course'   => 'previous course',
        ];

        $oldValues = [];
        foreach (array_keys($validated) as $field) {
            $oldValues[$field] = $student->getAttribute($field);
        }

        $student->update($validated);
        $student->refresh();

        $changed = [];
        foreach ($validated as $field => $newVal) {
            if ((string) ($oldValues[$field] ?? '') !== (string) ($newVal ?? '')) {
                $changed[] = $fieldLabels[$field] ?? str_replace('_', ' ', $field);
            }
        }

        $studentName   = trim($student->first_name . ' ' . $student->last_name);
        $studentNumber = $student->student_number ?? "ID#{$student->id}";
        $changedStr    = $changed ? implode(', ', $changed) : 'no changes';
        $ip            = $request->ip();

        SystemLog::create([
            'action'  => "Student {$studentNumber} ({$studentName}) updated profile: {$changedStr} [IP: {$ip}]",
            'user_id' => $request->user()->id,
            'role'    => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);

        return response()->json([
            'message' => 'SIS updated successfully.',
            'student' => $student->load('program'),
        ]);
    }

    /**
     * GET /api/student/academic-summary
     * Returns the authenticated student's academic summary.
     */
    public function academicSummary(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 404);
        }

        $student->load('program');
        
        $standingService = app(\App\Services\AcademicStandingService::class);
        $progressionService = app(\App\Services\AcademicProgressionService::class);
        
        $summary = $standingService->getAcademicSummary($student);
        $roadmapData = $progressionService->getCurriculumRoadmap($student);
        
        $residencyService = app(\App\Services\AcademicResidencyValidationService::class);
        $residency = $residencyService->computeResidency($student);

        // Compute Notifications
        $notifications = [];
        
        if ($summary['latin_honors']['eligible']) {
            $notifications[] = [
                'type' => 'success',
                'message' => 'Congratulations! You are currently eligible for Latin Honors: ' . $summary['latin_honors']['honor']
            ];
        }
        
        if ($roadmapData['failed_subjects_count'] > 0) {
            $notifications[] = [
                'type' => 'warning',
                'message' => 'You have ' . $roadmapData['failed_subjects_count'] . ' failed subject(s) that require a retake.'
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
            'notifications' => $notifications,
            'residency' => $residency
        ]);
    }
}
