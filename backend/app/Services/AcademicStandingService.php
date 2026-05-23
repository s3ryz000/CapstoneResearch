<?php

namespace App\Services;

use App\Models\Student;
use App\Models\Grade;

class AcademicStandingService
{
    /**
     * Get full academic summary including GWA, GPAs, and Honors eligibility.
     */
    public function getAcademicSummary(Student $student): array
    {
        $overallGwa = $this->computeOverallGwa($student);
        $latinHonors = $this->checkLatinHonorEligibility($student, $overallGwa);

        $terms = [];
        $annualGroups = [];

        // Fetch all distinct terms the student has grades for
        $grades = Grade::where('student_id', $student->student_id)
            ->get();

        $termKeys = $grades->map(fn($g) => $g->academic_year . '|' . $g->semester)->unique();

        foreach ($termKeys as $key) {
            [$ay, $sem] = explode('|', $key);
            $semGpa = $this->computeSemesterGpa($student, $ay, $sem);
            $deansList = $this->checkDeanList($student, $ay, $sem, $semGpa);

            $terms[] = [
                'academic_year' => $ay,
                'semester' => $sem,
                'gpa' => $semGpa,
                'deans_list' => $deansList,
            ];

            if (!isset($annualGroups[$ay])) {
                $annualGroups[$ay] = [];
            }
            $annualGroups[$ay][] = $sem;
        }

        $years = [];
        foreach ($annualGroups as $ay => $sems) {
            $annualGpa = $this->computeAnnualGpa($student, $ay);
            $presidentsList = $this->checkPresidentList($student, $ay, $annualGpa);

            $years[] = [
                'academic_year' => $ay,
                'gpa' => $annualGpa,
                'presidents_list' => $presidentsList,
            ];
        }

        // Sort terms chronologically (simplistic sort by AY and Sem)
        usort($terms, function($a, $b) {
            if ($a['academic_year'] === $b['academic_year']) {
                return $a['semester'] <=> $b['semester'];
            }
            return $a['academic_year'] <=> $b['academic_year'];
        });

        return [
            'overall_gwa' => $overallGwa,
            'latin_honors' => $latinHonors,
            'terms' => $terms,
            'years' => $years,
        ];
    }

    /**
     * Compute Semestral GPA
     */
    public function computeSemesterGpa(Student $student, string $academicYear, string $semester): ?float
    {
        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->get();

        return $this->calculateWeightedAverage($grades);
    }

    /**
     * Compute Annual GPA
     */
    public function computeAnnualGpa(Student $student, string $academicYear): ?float
    {
        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->where('academic_year', $academicYear)
            ->get();

        return $this->calculateWeightedAverage($grades);
    }

    /**
     * Compute Overall GWA
     */
    public function computeOverallGwa(Student $student): ?float
    {
        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->get();

        return $this->calculateWeightedAverage($grades);
    }

    /**
     * Recompute and cache the overall GWA in the students table
     */
    public function recomputeAndCacheOverallGwa(Student $student): void
    {
        $gwa = $this->computeOverallGwa($student);
        $student->update(['GPA' => $gwa]);
    }

    /**
     * Check Dean's List Eligibility for a semester
     */
    public function checkDeanList(Student $student, string $academicYear, string $semester, ?float $semGpa): array
    {
        if ($semGpa === null) {
            return ['eligible' => false, 'reason' => 'No numeric grades available for this semester.'];
        }

        if ($semGpa > 1.75) {
            return ['eligible' => false, 'reason' => "Semestral GPA ($semGpa) is lower than the required 1.75."];
        }

        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->get();

        return $this->evaluateHonorGrades($grades);
    }

    /**
     * Check President's List Eligibility for an academic year
     */
    public function checkPresidentList(Student $student, string $academicYear, ?float $annualGpa): array
    {
        if ($annualGpa === null) {
            return ['eligible' => false, 'reason' => 'No numeric grades available for this academic year.'];
        }

        if ($annualGpa > 1.75) {
            return ['eligible' => false, 'reason' => "Annual GPA ($annualGpa) is lower than the required 1.75."];
        }

        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->where('academic_year', $academicYear)
            ->get();

        return $this->evaluateHonorGrades($grades);
    }

    /**
     * Check Latin Honor Eligibility
     */
    public function checkLatinHonorEligibility(Student $student, ?float $overallGwa): array
    {
        if ($overallGwa === null) {
            return ['eligible' => false, 'honor' => null, 'reason' => 'No numeric grades available.'];
        }

        $grades = Grade::with('subject')
            ->where('student_id', $student->student_id)
            ->get();

        $gradesCheck = $this->evaluateHonorGrades($grades);
        if (!$gradesCheck['eligible']) {
            return array_merge($gradesCheck, ['honor' => null]);
        }

        if ($overallGwa >= 1.00 && $overallGwa <= 1.20) {
            return ['eligible' => true, 'honor' => 'Summa Cum Laude', 'reason' => 'Meets all requirements.'];
        }

        if ($overallGwa >= 1.21 && $overallGwa <= 1.45) {
            return ['eligible' => true, 'honor' => 'Magna Cum Laude', 'reason' => 'Meets all requirements.'];
        }

        if ($overallGwa >= 1.46 && $overallGwa <= 1.75) {
            return ['eligible' => true, 'honor' => 'Cum Laude', 'reason' => 'Meets all requirements.'];
        }

        return ['eligible' => false, 'honor' => null, 'reason' => "Overall GWA ($overallGwa) does not meet Latin Honor requirements."];
    }

    // ── Private Helpers ──────────────────────────────────────────────────

    private function calculateWeightedAverage($grades): ?float
    {
        $totalWeighted = 0;
        $totalUnits = 0;

        foreach ($grades as $grade) {
            // Exclude Credited and Withdrawn
            if (in_array($grade->status, ['Credited', 'Withdrawn', 'FDA', 'DRP', 'Cancelled', 'Enrolled'])) {
                continue;
            }

            // Exclude if no grade value
            if ($grade->grade_value === null) {
                // If it's a Failed grade without value (e.g. 5.00), treat as 5.00
                if ($grade->status === 'Failed') {
                    $units = $grade->subject?->units ?? 0;
                    $totalWeighted += (5.00 * $units);
                    $totalUnits += $units;
                }
                continue;
            }

            $units = $grade->subject?->units ?? 0;
            $totalWeighted += ($grade->grade_value * $units);
            $totalUnits += $units;
        }

        if ($totalUnits === 0) {
            return null;
        }

        return round($totalWeighted / $totalUnits, 2);
    }

    private function evaluateHonorGrades($grades): array
    {
        foreach ($grades as $grade) {
            $code = $grade->subject?->code ?? 'Unknown Subject';

            if ($grade->status === 'Enrolled') {
                return [
                    'eligible' => false,
                    'reason' => "Still enrolled in $code. Grades are incomplete."
                ];
            }

            if (in_array($grade->status, ['Failed', 'INC', 'FDA', 'DRP', 'Withdrawn', 'Cancelled'])) {
                return [
                    'eligible' => false,
                    'reason' => "Has a {$grade->status} grade in $code."
                ];
            }

            if ($grade->grade_value !== null && $grade->grade_value > 2.00) {
                return [
                    'eligible' => false,
                    'reason' => "Grade in $code is {$grade->grade_value}, which is lower than 2.00."
                ];
            }
        }

        return ['eligible' => true, 'reason' => 'Meets all requirements.'];
    }
}
