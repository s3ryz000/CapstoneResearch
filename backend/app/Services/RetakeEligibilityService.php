<?php

namespace App\Services;

use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Student;

/**
 * RetakeEligibilityService
 *
 * Determines which previously failed/withdrawn/FDA subjects a student
 * is eligible to retake in the next allowed term.
 *
 * Design rules:
 * ─────────────────────────────────────────────────────────────────────
 * Statuses that BLOCK retake (subject is finalized in a good state):
 *   - Passed
 *   - Credited
 *   - Enrolled     (active enrollment still in progress)
 *
 * Statuses that ALLOW retake (latest attempt was unsuccessful):
 *   - Failed
 *   - Withdrawn
 *   - FDA
 *
 * INC rule:
 *   INC is NOT automatically a retake candidate. The system expects INC
 *   to be resolved (converted to Passed/Failed). Subjects with an INC
 *   latest status are returned separately as `inc_subjects` with a
 *   blocking message.
 *
 * Semester-matching rule:
 *   A failed 1st-semester subject is only available for retake when the
 *   next allowed term is also a 1st semester (of any later academic year).
 *   A failed 2nd-semester subject is only available for retake when the
 *   next allowed term is a 2nd semester.
 *   Year level of the original failure does NOT need to match.
 *
 * Duplicate prevention:
 *   Subjects with an active enrollment in the same academic_year + semester
 *   as the next allowed term are excluded (already being enrolled).
 *   We do NOT use a global unique constraint on (student_id, subject_id).
 *
 * "Latest attempt" logic:
 *   For each subject, we look at ALL grade rows (ordered by created_at DESC)
 *   and take the single most-recent grade. The status of THAT grade drives
 *   the retake decision. This means if a student failed a subject, then was
 *   subsequently marked Passed, the subject will NOT appear as a retake.
 * ─────────────────────────────────────────────────────────────────────
 */
class RetakeEligibilityService
{
    /**
     * Statuses that mean a subject is done and passed — never retakeable.
     */
    private const PASSED_STATUSES = ['Passed', 'Credited'];

    /**
     * Statuses that make a subject retakeable.
     */
    private const RETAKE_STATUSES = ['Failed', 'Withdrawn', 'FDA'];

    /**
     * Grade values treated as Failed (legacy numeric-only grades).
     */
    private const FAILED_GRADE_VALUE = 5.00;

    /**
     * Main entry point.
     *
     * @param  Student $student          The student being evaluated.
     * @param  array   $nextAllowedTerm  Output of AcademicProgressionService::computeNextAllowedTerm().
     *                                  Must contain: year_level, semester, academic_year.
     *
     * @return array {
     *   retake_subjects_required:      All subjects whose latest attempt is Failed/Withdrawn/FDA.
     *   retake_subjects_available:     Subset of required where curriculum semester matches next term semester.
     *   inc_subjects:                  Subjects whose latest attempt is INC — not retakeable, needs resolution.
     * }
     */
    public function getRetakeEligibility(Student $student, array $nextAllowedTerm): array
    {
        if (!$student->program_id || empty($nextAllowedTerm['semester'])) {
            return [
                'retake_subjects_required'  => [],
                'retake_subjects_available' => [],
                'inc_subjects'              => [],
            ];
        }

        $nextSemester    = (int) $nextAllowedTerm['semester'];
        $nextAcademicYear = $nextAllowedTerm['academic_year'];

        // ── Step 1: Collect all grades for this student, one row per subject ──
        // We need the LATEST grade per subject_id to determine current status.
        $allGrades = Grade::where('student_id', $student->student_id)
            ->with('subject')
            ->orderBy('created_at', 'asc') // ascending so the last one wins below
            ->get();

        // Build a map: subject_id => latest Grade model
        $latestGradeBySubject = [];
        foreach ($allGrades as $grade) {
            // Later grades overwrite earlier ones (last write wins due to ascending order)
            $latestGradeBySubject[$grade->subject_id] = $grade;
        }

        // ── Step 2: Identify subjects whose LATEST status is retakeable ──

        $required   = []; // all retakeable subjects regardless of semester
        $incSubjects = []; // INC subjects — need resolution, not retakeable yet

        foreach ($latestGradeBySubject as $subjectId => $grade) {
            $status = $this->resolveEffectiveStatus($grade);

            if ($status === 'INC') {
                $incSubjects[] = $this->buildSubjectEntry($grade, $status, [
                    'blocked_reason' =>
                        "This subject has an INC status. Complete or convert the INC " .
                        "before creating a retake enrollment.",
                ]);
                continue;
            }

            if (in_array($status, self::PASSED_STATUSES)) {
                continue; // Already passed/credited — not a retake candidate
            }

            if (!in_array($status, self::RETAKE_STATUSES)) {
                continue; // Enrolled or unknown — not a retake candidate
            }

            // ── Step 3: Confirm subject exists in student's active program curriculum ──
            $curriculumEntry = Curriculum::where('program_id', $student->program_id)
                ->where('subject_id', $subjectId)
                ->first();

            if (!$curriculumEntry) {
                // Subject not in this program's curriculum — skip silently.
                // (Handles program transfers or legacy data.)
                continue;
            }

            // ── Step 4: Duplicate prevention ──
            // Block if already actively enrolled in the SAME next term (same AY + semester).
            $alreadyEnrolledNextTerm = Enrollment::where('student_id', $student->student_id)
                ->where('subject_id', $subjectId)
                ->where('academic_year', $nextAcademicYear)
                ->where('semester', $nextSemester)
                ->whereNull('deleted_at')
                ->whereNotIn('status', ['Cancelled', 'archived'])
                ->exists();

            if ($alreadyEnrolledNextTerm) {
                continue; // Already queued for this term — skip
            }

            $required[] = $this->buildSubjectEntry($grade, $status, [
                'curriculum_semester' => $curriculumEntry->semester,
                'curriculum_year_level' => $curriculumEntry->year_level,
            ]);
        }

        // ── Step 5: Build the "available this term" list ─────────────────────
        // Universal rule: a failed/withdrawn/FDA subject is eligible for retake
        // in ANY future term regardless of semester.
        // The only gate is the exact-term duplicate check already done in Step 4.
        $available = $required;

        return [
            'retake_subjects_required'  => array_values($required),
            'retake_subjects_available' => array_values($available),
            'inc_subjects'              => $incSubjects,
        ];
    }

    /**
     * Validate that a list of subject_ids are valid retake candidates for the given term.
     * Returns a list of validated retake subject IDs and any errors.
     *
     * Used by AcademicProgressionService::validateAddNextTerm().
     *
     * @param  Student  $student
     * @param  array    $subjectIds       Subject IDs the registrar wants to retake
     * @param  array    $nextAllowedTerm  Backend-computed next term
     * @return array{ valid_ids: int[], errors: string[] }
     */
    public function validateRetakeSubjects(Student $student, array $subjectIds, array $nextAllowedTerm): array
    {
        $eligibility    = $this->getRetakeEligibility($student, $nextAllowedTerm);
        $requiredIds    = array_column($eligibility['retake_subjects_required'], 'subject_id');
        $incIds         = array_column($eligibility['inc_subjects'], 'subject_id');
        $passedIds      = $this->getPassedSubjectIds($student);

        $validIds = [];
        $errors   = [];

        foreach ($subjectIds as $subjectId) {
            $subject = \App\Models\Subject::find($subjectId);
            $code    = $subject?->code ?? "Subject #{$subjectId}";

            // Must be a genuine retake candidate (latest status = Failed/Withdrawn/FDA)
            if (in_array($subjectId, $incIds)) {
                $errors[] = "{$code} has an INC status. Resolve INC before creating a retake.";
                continue;
            }
            if (!in_array($subjectId, $requiredIds)) {
                $errors[] = "{$code} is not eligible for retake (not Failed, Withdrawn, or FDA, or already enrolled this term).";
                continue;
            }

            // Prerequisite check: retake subjects must still satisfy their prerequisites
            $prereqEntry = \App\Models\Curriculum::with(['prerequisites', 'prerequisite'])
                ->where('program_id', $student->program_id)
                ->where('subject_id', $subjectId)
                ->first();

            if ($prereqEntry) {
                if ($prereqEntry->prerequisites->isNotEmpty()) {
                    $reqPrereqIds   = $prereqEntry->prerequisites->pluck('id')->toArray();
                    $prereqSubjects = $prereqEntry->prerequisites;
                } else {
                    $legacyId = $prereqEntry->getAttributes()['prerequisite'] ?? null;
                    if ($legacyId) {
                        $legacySub      = $prereqEntry->getRelationValue('prerequisite') ?? \App\Models\Subject::find($legacyId);
                        $reqPrereqIds   = $legacySub ? [$legacyId] : [];
                        $prereqSubjects = $legacySub ? collect([$legacySub]) : collect();
                    } else {
                        $reqPrereqIds   = [];
                        $prereqSubjects = collect();
                    }
                }

                if ($prereqSubjects->isNotEmpty()) {
                    $missingIds = array_diff($reqPrereqIds, $passedIds);
                    if (!empty($missingIds)) {
                        $missingCodes = $prereqSubjects
                            ->filter(fn($p) => in_array($p->id, $missingIds))
                            ->pluck('code')
                            ->join(', ');
                        $errors[] = "{$missingCodes} must be completed (Passed/Credited) before enrolling in {$code}.";
                        continue;
                    }
                }
            }

            // Exact-term duplicate check: block only if already enrolled in same AY+semester
            $duplicateExists = \App\Models\Enrollment::where('student_id', $student->student_id)
                ->where('subject_id', $subjectId)
                ->where('academic_year', $nextAllowedTerm['academic_year'])
                ->where('semester', $nextAllowedTerm['semester'])
                ->whereNull('deleted_at')
                ->whereNotIn('status', ['Cancelled', 'archived'])
                ->exists();

            if ($duplicateExists) {
                $errors[] = "{$code} is already enrolled for A.Y. {$nextAllowedTerm['academic_year']}, Semester {$nextAllowedTerm['semester']}.";
                continue;
            }

            $validIds[] = $subjectId;
        }

        return [
            'valid_ids' => $validIds,
            'errors'    => $errors,
        ];
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Return subject IDs the student has passed or credited (across all terms).
     */
    private function getPassedSubjectIds(Student $student): array
    {
        return \App\Models\Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->whereIn('status', self::PASSED_STATUSES)
                  ->orWhere(function ($inner) {
                      $inner->whereNotNull('grade_value')
                            ->where('grade_value', '>=', 1.00)
                            ->where('grade_value', '<=', 3.00)
                            ->whereNull('status');
                  })
                  ->orWhere(function ($inner) {
                      $inner->whereNull('status')
                            ->whereIn('remarks', ['PASSED', 'Passed', 'CREDITED', 'Credited']);
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->toArray();
    }
    /**
     * Resolve the effective status of a grade row.
     * Handles legacy data (grade_value only, no status column, or remarks-based).
     */
    private function resolveEffectiveStatus(Grade $grade): string
    {
        // 1. Explicit status column (most reliable)
        if ($grade->status && $grade->status !== 'Enrolled') {
            return $grade->status;
        }

        // 2. Legacy: grade_value = 5.00 → Failed
        if ($grade->grade_value !== null && abs((float) $grade->grade_value - self::FAILED_GRADE_VALUE) < 0.001) {
            return 'Failed';
        }

        // 3. Legacy: grade_value 1.00–3.00 → Passed
        if ($grade->grade_value !== null
            && (float) $grade->grade_value >= 1.00
            && (float) $grade->grade_value <= 3.00) {
            return 'Passed';
        }

        // 4. Legacy: remarks-based
        if ($grade->remarks) {
            $r = strtoupper(trim($grade->remarks));
            $map = [
                'PASSED'    => 'Passed',
                'FAILED'    => 'Failed',
                'INC'       => 'INC',
                'WITHDRAWN' => 'Withdrawn',
                'FDA'       => 'FDA',
                'CREDITED'  => 'Credited',
            ];
            if (isset($map[$r])) {
                return $map[$r];
            }
        }

        // 5. status = Enrolled or null → currently enrolled (not retakeable yet)
        return 'Enrolled';
    }

    /**
     * Build the retake subject array entry for the API response.
     *
     * Field names use `previous_*` prefix so the frontend can read them
     * directly without any mapping gymnastics.
     */
    private function buildSubjectEntry(Grade $grade, string $status, array $extra = []): array
    {
        // Resolve year_level from the linked enrollment if available
        $previousYearLevel    = null;
        $previousEnrollmentId = null;

        if ($grade->enrollment_id) {
            $enrollment = \App\Models\Enrollment::find($grade->enrollment_id);
            if ($enrollment) {
                $previousYearLevel    = $enrollment->year_level;
                $previousEnrollmentId = $enrollment->id;
            }
        }

        return array_merge([
            'grade_id'               => $grade->id,
            'subject_id'             => $grade->subject_id,
            'subject_code'           => $grade->subject?->code ?? '',
            'subject_title'          => $grade->subject?->title ?? '',
            'units'                  => $grade->subject?->units ?? 0,
            // ── Previous attempt metadata (what the frontend displays) ──
            'previous_academic_year' => $grade->academic_year,
            'previous_semester'      => $grade->semester,
            'previous_year_level'    => $previousYearLevel,
            'previous_enrollment_id' => $previousEnrollmentId,
            // ── Grade details ──
            'grade_value'            => $grade->grade_value,
            'remarks'                => $grade->remarks,
            'latest_status'          => $status,
            // ── Curriculum placement (filled by caller) ──
            'curriculum_semester'    => null,
            'curriculum_year_level'  => null,
        ], $extra);
    }
}
