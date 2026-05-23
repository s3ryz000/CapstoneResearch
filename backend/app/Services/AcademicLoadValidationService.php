<?php

namespace App\Services;

use App\Models\Curriculum;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;

/**
 * AcademicLoadValidationService
 *
 * Enforces TMCC academic load rules for next-term enrollment:
 *   - Minimum: 18 units per semester
 *   - Maximum: 26 units per semester (strict, no exceptions)
 *
 * Underload exception (below 18):
 *   Allowed only when the system itself cannot offer 18 eligible units
 *   due to curriculum placement and prerequisite constraints. This covers:
 *     1. Fourth-year / graduating students with fewer than 18 remaining units.
 *     2. Irregular students whose prerequisite blocks leave fewer than 18
 *        eligible units in the next term.
 *   If more eligible subjects exist but the student simply didn't select them,
 *   enrollment is BLOCKED.
 */
class AcademicLoadValidationService
{
    const MINIMUM_UNITS = 18;
    const MAXIMUM_UNITS = 26;

    /**
     * Validate the academic load for a set of selected subject IDs.
     *
     * @param  array  $allSelectedSubjectIds  All selected IDs (regular + retake combined)
     * @param  int    $maxEligibleUnits        Total units the student could enroll (pre-computed)
     * @return array{
     *   selected_units: int,
     *   max_eligible_units: int,
     *   minimum_units: int,
     *   maximum_units: int,
     *   is_valid_load: bool,
     *   load_status: string,
     *   message: string,
     *   reason_for_exception: ?string
     * }
     */
    public function validate(array $allSelectedSubjectIds, int $maxEligibleUnits): array
    {
        $selectedUnits = $allSelectedSubjectIds
            ? (int) Subject::whereIn('id', $allSelectedSubjectIds)->sum('units')
            : 0;

        // Above maximum — always block, no exceptions
        if ($selectedUnits > self::MAXIMUM_UNITS) {
            return $this->result(
                $selectedUnits, $maxEligibleUnits,
                false, 'above_maximum',
                "Selected units ({$selectedUnits}) exceed the " . self::MAXIMUM_UNITS .
                "-unit maximum allowed per semester. Remove subjects before enrolling."
            );
        }

        // Within normal range — valid
        if ($selectedUnits >= self::MINIMUM_UNITS) {
            return $this->result(
                $selectedUnits, $maxEligibleUnits,
                true, 'valid',
                "Academic load of {$selectedUnits} units is within the valid range (" .
                self::MINIMUM_UNITS . "–" . self::MAXIMUM_UNITS . " units)."
            );
        }

        // Below minimum — check for underload exception
        // Exception applies when the curriculum + prerequisites make it impossible
        // to reach 18 units, not merely inconvenient.
        if ($maxEligibleUnits < self::MINIMUM_UNITS) {
            $reason = "The curriculum and prerequisite constraints limit the available eligible " .
                      "subjects to {$maxEligibleUnits} units for this term, which is below " .
                      "the 18-unit minimum. Enrollment is allowed as a valid underload.";
            return $this->result(
                $selectedUnits, $maxEligibleUnits,
                true, 'valid_underload_exception',
                "Underload exception: only {$maxEligibleUnits} eligible units are available " .
                "for this term. Enrollment with {$selectedUnits} units is allowed.",
                $reason
            );
        }

        // Below minimum with more subjects available — block
        return $this->result(
            $selectedUnits, $maxEligibleUnits,
            false, 'below_minimum',
            "Selected units ({$selectedUnits}) are below the " . self::MINIMUM_UNITS .
            "-unit minimum. Add more eligible subjects before enrolling."
        );
    }

    /**
     * Compute the total units of all subjects the student is currently eligible
     * to enroll in for the next term. This is the authoritative ceiling used
     * to determine whether an underload exception applies.
     *
     * Includes:
     *   - Eligible curriculum subjects for the next term (prerequisites met)
     *   - Eligible retake subjects (not already in the curriculum list for this term)
     */
    public function computeMaxEligibleUnits(Student $student, array $nextTerm): int
    {
        if (!($nextTerm['can_add'] ?? false) || !$nextTerm['year_level'] || !$nextTerm['semester']) {
            return 0;
        }

        $progressionService = app(AcademicProgressionService::class);
        $retakeService      = app(RetakeEligibilityService::class);

        // Get regular curriculum subjects for the next term
        $regularSubjects = $progressionService->getAvailableSubjects(
            $student,
            (int) $nextTerm['year_level'],
            (int) $nextTerm['semester']
        );

        // Get retake-eligible subjects
        $retakeData  = $retakeService->getRetakeEligibility($student, $nextTerm);
        $existingIds = array_column($regularSubjects, 'subject_id');
        $passedIds   = $this->getPassedSubjectIds($student);

        $totalUnits = 0;

        // Sum eligible regular curriculum subjects
        foreach ($regularSubjects as $subj) {
            if ($subj['eligible'] ?? false) {
                $totalUnits += (int) ($subj['units'] ?? 0);
            }
        }

        // Sum eligible retake subjects not already in the curriculum list
        foreach ($retakeData['retake_subjects_available'] as $retake) {
            if (in_array($retake['subject_id'], $existingIds)) {
                continue; // Already counted via regular curriculum list
            }

            // Check prerequisites for this retake subject
            $eligible  = true;
            $prereqRow = Curriculum::with('prerequisites')
                ->where('program_id', $student->program_id)
                ->where('subject_id', $retake['subject_id'])
                ->first();

            if ($prereqRow && $prereqRow->prerequisites->isNotEmpty()) {
                $reqIds = $prereqRow->prerequisites->pluck('id')->toArray();
                if (!empty(array_diff($reqIds, $passedIds))) {
                    $eligible = false;
                }
            }

            if ($eligible) {
                $totalUnits += (int) ($retake['units'] ?? 0);
            }
        }

        return $totalUnits;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

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
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->toArray();
    }

    private function result(
        int     $selectedUnits,
        int     $maxEligibleUnits,
        bool    $isValid,
        string  $status,
        string  $message,
        ?string $exceptionReason = null
    ): array {
        return [
            'selected_units'       => $selectedUnits,
            'max_eligible_units'   => $maxEligibleUnits,
            'minimum_units'        => self::MINIMUM_UNITS,
            'maximum_units'        => self::MAXIMUM_UNITS,
            'is_valid_load'        => $isValid,
            'load_status'          => $status,
            'message'              => $message,
            'reason_for_exception' => $exceptionReason,
        ];
    }
}
