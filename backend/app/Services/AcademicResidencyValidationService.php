<?php

namespace App\Services;

use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Student;
use Carbon\Carbon;

/**
 * AcademicResidencyValidationService
 *
 * Enforces TMCC maximum residency policy:
 *   - Normal program: 4 academic years (8 semesters, terms 1–8)
 *   - Extension period: 1 additional academic year (terms 9–10)
 *   - Maximum total: 5 academic years / 10 semesters
 *
 * Residency status is determined by the PROJECTED NEXT TERM INDEX,
 * not by elapsed calendar time or academic year strings. This makes
 * the service immune to stray enrollment rows with null year_level
 * (created during student registration) and to enrollment_date/
 * graduation_date mismatches in demo or legacy data.
 *
 * Term counting uses (year_level, semester) pairs from enrollment
 * records, NOT (academic_year, semester) pairs.
 *
 * Statuses:
 *   within_regular_program      — next term is 1–8
 *   fifth_year_extension        — next term is 9 or 10
 *   ineligible_max_residency    — next term would be 11+
 *   completed                   — all curriculum subjects passed/credited
 */
class AcademicResidencyValidationService
{
    const MAXIMUM_RESIDENCY_YEARS  = 5;
    const SEMESTERS_PER_YEAR       = 2;
    const MAX_UNITS_PER_SEMESTER   = 26;

    // Maximum semesters in the full program (including extension)
    const TOTAL_MAX_SEMESTERS      = 10;  // 5 years × 2 semesters

    /**
     * Compute the full residency state for a student.
     *
     * @return array{
     *   first_enrollment_year: int|null,
     *   maximum_residency_years: int,
     *   elapsed_academic_years: int,
     *   used_regular_terms: int,
     *   used_fifth_year_terms: int,
     *   next_term_number: int,
     *   remaining_required_subjects: array,
     *   remaining_required_units: int,
     *   failed_required_subjects: array,
     *   unresolved_retake_subjects: array,
     *   projected_completion_possible: bool,
     *   residency_status: string
     * }
     */
    public function computeResidency(Student $student): array
    {
        if (!$student->program_id) {
            return $this->emptyResult();
        }

        $firstEnrollmentYear = $student->enrollment_date
            ? Carbon::parse($student->enrollment_date)->year
            : null;

        // ── Curriculum analysis ──────────────────────────────────────────────
        $curriculumSubjects = Curriculum::with('subject')
            ->where('program_id', $student->program_id)
            ->get();

        $passedIds = $this->getPassedSubjectIds($student);

        $remainingRequired  = [];
        $totalRemainingUnits = 0;
        foreach ($curriculumSubjects as $entry) {
            if (in_array($entry->subject_id, $passedIds) || !$entry->subject) {
                continue;
            }
            $remainingRequired[] = [
                'subject_id'    => $entry->subject_id,
                'subject_code'  => $entry->subject->code,
                'subject_title' => $entry->subject->title,
                'units'         => (int) $entry->subject->units,
                'year_level'    => $entry->year_level,
                'semester'      => $entry->semester,
            ];
            $totalRemainingUnits += (int) $entry->subject->units;
        }

        // All curriculum subjects passed — student is done
        if (empty($remainingRequired)) {
            return [
                'first_enrollment_year'          => $firstEnrollmentYear,
                'maximum_residency_years'        => self::MAXIMUM_RESIDENCY_YEARS,
                'elapsed_academic_years'         => $this->countElapsedAcademicYears($student),
                'used_regular_terms'             => $this->countUsedRegularTerms($student),
                'used_fifth_year_terms'          => $this->countUsedFifthYearTerms($student),
                'next_term_number'               => null,
                'remaining_required_subjects'    => [],
                'remaining_required_units'       => 0,
                'failed_required_subjects'       => [],
                'unresolved_retake_subjects'     => [],
                'projected_completion_possible'  => true,
                'residency_status'               => 'completed',
            ];
        }

        // ── Failed required subjects ─────────────────────────────────────────
        $failedIds      = $this->getFailedSubjectIds($student, $passedIds);
        $failedRequired = array_values(
            array_filter($remainingRequired, fn($s) => in_array($s['subject_id'], $failedIds))
        );

        // ── Term-index-based counting ────────────────────────────────────────
        // Count distinct (year_level ∈ 1–4, semester) pairs that have real
        // enrollment records. This is immune to stray rows with year_level = NULL
        // that are created during student registration (store() uses null year_level).
        $usedRegularTerms    = $this->countUsedRegularTerms($student);
        $usedFifthYearTerms  = $this->countUsedFifthYearTerms($student);
        $totalUsedTerms      = $usedRegularTerms + $usedFifthYearTerms;

        // The NEXT term the student would enroll in (1-indexed).
        $nextTermNumber = $totalUsedTerms + 1;

        // Remaining semester slots (for completion projection only)
        $remainingSemesters  = max(0, self::TOTAL_MAX_SEMESTERS - $totalUsedTerms);
        $projectedPossible   = ($remainingSemesters > 0)
            && ($totalRemainingUnits <= ($remainingSemesters * self::MAX_UNITS_PER_SEMESTER));

        // ── Residency status based on projected next term ────────────────────
        // Term  1–8  → within regular 4-year program
        // Term  9–10 → 5th-year extension period
        // Term 11+   → maximum residency exceeded
        $regularTermsMax = (self::MAXIMUM_RESIDENCY_YEARS - 1) * self::SEMESTERS_PER_YEAR; // 8

        if ($nextTermNumber > self::TOTAL_MAX_SEMESTERS) {
            $residencyStatus = 'ineligible_max_residency';
        } elseif ($nextTermNumber > $regularTermsMax) {
            $residencyStatus = 'fifth_year_extension';
        } else {
            $residencyStatus = 'within_regular_program';
        }

        return [
            'first_enrollment_year'          => $firstEnrollmentYear,
            'maximum_residency_years'        => self::MAXIMUM_RESIDENCY_YEARS,
            'elapsed_academic_years'         => $this->countElapsedAcademicYears($student),
            'used_regular_terms'             => $usedRegularTerms,
            'used_fifth_year_terms'          => $usedFifthYearTerms,
            'next_term_number'               => $nextTermNumber,
            'remaining_required_subjects'    => $remainingRequired,
            'remaining_required_units'       => $totalRemainingUnits,
            'failed_required_subjects'       => $failedRequired,
            'unresolved_retake_subjects'     => $failedRequired,
            'projected_completion_possible'  => $projectedPossible,
            'residency_status'               => $residencyStatus,
        ];
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function emptyResult(): array
    {
        return [
            'first_enrollment_year'          => null,
            'maximum_residency_years'        => self::MAXIMUM_RESIDENCY_YEARS,
            'elapsed_academic_years'         => 0,
            'used_regular_terms'             => 0,
            'used_fifth_year_terms'          => 0,
            'next_term_number'               => 1,
            'remaining_required_subjects'    => [],
            'remaining_required_units'       => 0,
            'failed_required_subjects'       => [],
            'unresolved_retake_subjects'     => [],
            'projected_completion_possible'  => false,
            'residency_status'               => 'within_regular_program',
        ];
    }

    /**
     * Count distinct (year_level ∈ 1–4, semester) enrollment pairs.
     *
     * This is the correct way to count "used regular terms" because:
     *  - It uses year_level, not academic_year, so it's immune to stray
     *    rows that have null year_level but span many academic years.
     *  - Maximum possible result is 8 (4 years × 2 semesters).
     */
    private function countUsedRegularTerms(Student $student): int
    {
        return Enrollment::where('student_id', $student->student_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['archived', 'Cancelled'])
            ->whereIn('year_level', [1, 2, 3, 4])
            ->select('year_level', 'semester')
            ->distinct()
            ->count();
    }

    /**
     * Count distinct semester values for 5th-year (year_level = 5) enrollments.
     * Maximum possible result is 2.
     */
    private function countUsedFifthYearTerms(Student $student): int
    {
        return Enrollment::where('student_id', $student->student_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['archived', 'Cancelled'])
            ->where('year_level', 5)
            ->select('semester')
            ->distinct()
            ->count();
    }

    /**
     * Count distinct non-null academic years across all non-cancelled enrollments.
     * Used only for informational display; NOT used for blocking decisions.
     */
    private function countElapsedAcademicYears(Student $student): int
    {
        return Enrollment::where('student_id', $student->student_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['archived', 'Cancelled'])
            ->whereNotNull('academic_year')
            ->pluck('academic_year')
            ->unique()
            ->count();
    }

    private function getPassedSubjectIds(Student $student): array
    {
        return Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->whereIn('status', ['Passed', 'Credited'])
                  ->orWhere(function ($i) {
                      $i->whereNotNull('grade_value')
                        ->where('grade_value', '>=', 1.00)
                        ->where('grade_value', '<=', 3.00)
                        ->whereNull('status');
                  })
                  ->orWhere(function ($i) {
                      $i->whereNull('status')
                        ->whereIn('remarks', ['PASSED', 'Passed', 'CREDITED', 'Credited']);
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->toArray();
    }

    /**
     * Subject IDs where the LATEST grade is Failed/Withdrawn/FDA and not subsequently passed.
     */
    private function getFailedSubjectIds(Student $student, array $passedIds): array
    {
        return Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->whereIn('status', ['Failed', 'Withdrawn', 'FDA'])
                  ->orWhere(function ($i) {
                      $i->where('grade_value', 5.00)->whereNull('status');
                  })
                  ->orWhere(function ($i) {
                      $i->whereNull('status')
                        ->whereIn('remarks', ['FAILED', 'Failed', 'WITHDRAWN', 'Withdrawn', 'FDA']);
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->filter(fn($id) => !in_array($id, $passedIds))
            ->values()
            ->toArray();
    }
}
