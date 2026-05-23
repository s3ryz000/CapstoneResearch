<?php

namespace App\Services;

use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;
use Carbon\Carbon;

class AcademicProgressionService
{
    /**
     * Valid final statuses that count as "completed" for progression purposes.
     */
    const FINAL_STATUSES = ['Passed', 'Failed', 'INC', 'Withdrawn', 'FDA', 'Credited', 'Cancelled'];

    /**
     * Statuses that count as "passed" for prerequisite checks.
     */
    const PASSED_STATUSES = ['Passed', 'Credited'];

    /**
     * Statuses that require retake.
     */
    const RETAKE_STATUSES = ['Failed', 'Withdrawn', 'FDA'];

    /**
     * The strict ordering of terms in a 4-year program.
     */
    const TERM_ORDER = [
        ['year_level' => 1, 'semester' => 1],
        ['year_level' => 1, 'semester' => 2],
        ['year_level' => 2, 'semester' => 1],
        ['year_level' => 2, 'semester' => 2],
        ['year_level' => 3, 'semester' => 1],
        ['year_level' => 3, 'semester' => 2],
        ['year_level' => 4, 'semester' => 1],
        ['year_level' => 4, 'semester' => 2],
    ];

    /**
     * Grade value to remarks mapping.
     */
    const GRADE_REMARKS = [
        1.00 => 'Excellent',
        1.25 => 'Superior',
        1.50 => 'Superior',
        1.75 => 'Very Good',
        2.00 => 'Good',
        2.25 => 'Good',
        2.50 => 'Fair',
        2.75 => 'Fair',
        3.00 => 'Passed',
        4.00 => 'INC',
        5.00 => 'Failed',
    ];

    /**
     * Compute allowed academic years for a student.
     */
    public function computeAllowedAcademicYears(Student $student): array
    {
        $enrollmentDate = $student->enrollment_date;
        if (!$enrollmentDate) {
            return [];
        }

        $startYear = Carbon::parse($enrollmentDate)->year;

        if ($student->graduation_date) {
            $endYear = Carbon::parse($student->graduation_date)->year;
            // The last AY ends in the graduation year
            $years = [];
            for ($y = $startYear; $y < $endYear; $y++) {
                $years[] = "{$y}-" . ($y + 1);
            }
            // Include the graduation year if the grad date is in the later half
            if (Carbon::parse($student->graduation_date)->month >= 3) {
                $lastAY = ($endYear - 1) . "-{$endYear}";
                if (!in_array($lastAY, $years)) {
                    $years[] = $lastAY;
                }
            }
            // Also include if graduation is in same year as start of an AY
            $gradAY = ($endYear - 1) . "-{$endYear}";
            if (!in_array($gradAY, $years)) {
                $years[] = $gradAY;
            }
            return array_unique($years);
        }

        // No graduation: 4 years + 1 extension
        $years = [];
        for ($y = $startYear; $y < $startYear + 5; $y++) {
            $years[] = "{$y}-" . ($y + 1);
        }
        return $years;
    }

    /**
     * Compute the academic year for a given term based on enrollment date.
     */
    public function computeAcademicYearForTerm(Student $student, int $yearLevel, int $semester): string
    {
        $startYear = Carbon::parse($student->enrollment_date)->year;
        $ayStartYear = $startYear + ($yearLevel - 1);
        return "{$ayStartYear}-" . ($ayStartYear + 1);
    }

    /**
     * Get the next allowed term for a student in strict sequential order.
     */
    public function computeNextAllowedTerm(Student $student): array
    {
        if (!$student->program_id) {
            return [
                'year_level' => null,
                'semester' => null,
                'academic_year' => null,
                'can_add' => false,
                'blocking_reason' => 'Student has no active program. Set a program before adding enrollments.',
            ];
        }

        // Get all active (non-soft-deleted, non-archived) enrollments with their grades
        $enrollments = Enrollment::where('student_id', $student->student_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['archived', 'Cancelled'])
            ->with('subject')
            ->get();

        // If no enrollments exist, the next term is 1st year, 1st semester
        if ($enrollments->isEmpty()) {
            $academicYear = $this->computeAcademicYearForTerm($student, 1, 1);
            $allowedYears = $this->computeAllowedAcademicYears($student);

            if (!in_array($academicYear, $allowedYears)) {
                return [
                    'year_level' => 1,
                    'semester' => 1,
                    'academic_year' => $academicYear,
                    'can_add' => false,
                    'blocking_reason' => "Academic year {$academicYear} is outside the student's allowed range.",
                ];
            }

            return [
                'year_level' => 1,
                'semester' => 1,
                'academic_year' => $academicYear,
                'can_add' => true,
                'blocking_reason' => null,
            ];
        }

        // Group enrollments by (year_level, semester) to find the latest term
        $termGroups = $enrollments->groupBy(function ($e) {
            return $e->year_level . '-' . $e->semester;
        });

        // Find the latest term that has enrollments
        $latestTermIndex = -1;
        foreach (self::TERM_ORDER as $index => $term) {
            $key = $term['year_level'] . '-' . $term['semester'];
            if ($termGroups->has($key)) {
                $latestTermIndex = $index;
            }
        }

        if ($latestTermIndex < 0) {
            // Enrollments exist but none have year_level set — treat as first term
            $academicYear = $this->computeAcademicYearForTerm($student, 1, 1);
            return [
                'year_level' => 1,
                'semester' => 1,
                'academic_year' => $academicYear,
                'can_add' => true,
                'blocking_reason' => null,
            ];
        }

        $latestTerm = self::TERM_ORDER[$latestTermIndex];
        $latestKey = $latestTerm['year_level'] . '-' . $latestTerm['semester'];
        $latestEnrollments = $termGroups[$latestKey];

        // Check if all subjects in the latest term have final grade/status
        $allComplete = true;
        $incompleteSubjects = [];

        foreach ($latestEnrollments as $enrollment) {
            $grade = Grade::where('student_id', $student->student_id)
                ->where('subject_id', $enrollment->subject_id)
                ->where('academic_year', $enrollment->academic_year)
                ->where('semester', $enrollment->semester)
                ->first();

            $hasFinaStatus = false;
            if ($grade) {
                // Check if grade has a final status
                if ($grade->status && in_array($grade->status, self::FINAL_STATUSES)) {
                    $hasFinaStatus = true;
                } elseif ($grade->grade_value !== null) {
                    // Legacy: has grade_value but no status — treat as complete
                    $hasFinaStatus = true;
                } elseif ($grade->remarks && in_array(strtoupper($grade->remarks), ['PASSED', 'FAILED', 'INC', 'WITHDRAWN', 'FDA', 'CREDITED'])) {
                    $hasFinaStatus = true;
                }
            }

            if (!$hasFinaStatus) {
                $allComplete = false;
                $subjectCode = $enrollment->subject?->code ?? "Subject #{$enrollment->subject_id}";
                $incompleteSubjects[] = $subjectCode;
            }
        }

        $semLabel = $latestTerm['semester'] == 1 ? '1st' : '2nd';
        $yearLabel = $this->ordinal($latestTerm['year_level']);
        $latestAY = $latestEnrollments->first()->academic_year ?? $this->computeAcademicYearForTerm($student, $latestTerm['year_level'], $latestTerm['semester']);

        if (!$allComplete) {
            // Current term not complete — cannot add next
            return [
                'year_level' => $latestTerm['year_level'],
                'semester' => $latestTerm['semester'],
                'academic_year' => $latestAY,
                'can_add' => false,
                'blocking_reason' => "Complete grades or final statuses for {$yearLabel} Year, {$semLabel} Semester, A.Y. {$latestAY} before adding the next semester.",
                'incomplete_subjects' => $incompleteSubjects,
            ];
        }

        // Current term is complete — compute the next term
        $nextTermIndex = $latestTermIndex + 1;

        if ($nextTermIndex >= count(self::TERM_ORDER)) {
            // All 8 terms completed
            return [
                'year_level' => null,
                'semester' => null,
                'academic_year' => null,
                'can_add' => false,
                'blocking_reason' => 'All terms for the 4-year program have been completed.',
                'program_completed' => true,
            ];
        }

        $nextTerm = self::TERM_ORDER[$nextTermIndex];
        $nextAY = $this->computeAcademicYearForTerm($student, $nextTerm['year_level'], $nextTerm['semester']);
        $allowedYears = $this->computeAllowedAcademicYears($student);

        if (!in_array($nextAY, $allowedYears)) {
            return [
                'year_level' => $nextTerm['year_level'],
                'semester' => $nextTerm['semester'],
                'academic_year' => $nextAY,
                'can_add' => false,
                'blocking_reason' => "Academic year {$nextAY} is outside the student's allowed range.",
            ];
        }

        return [
            'year_level' => $nextTerm['year_level'],
            'semester' => $nextTerm['semester'],
            'academic_year' => $nextAY,
            'can_add' => true,
            'blocking_reason' => null,
        ];
    }

    /**
     * Get subjects available for enrollment in a specific term.
     */
    public function getAvailableSubjects(Student $student, int $yearLevel, int $semester): array
    {
        if (!$student->program_id) {
            return [];
        }

        // Get curriculum subjects for this term
        $curriculumEntries = Curriculum::with(['subject', 'prerequisites', 'prerequisite'])
            ->where('program_id', $student->program_id)
            ->where('year_level', $yearLevel)
            ->where('semester', $semester)
            ->get();

        // Get all subject IDs the student has already passed or credited
        $passedSubjectIds = $this->getPassedSubjectIds($student);

        // "Actively enrolled" means: Enrolled status in the exact next term (AY + semester).
        // Old Failed/Withdrawn/FDA records are intentionally excluded so they never
        // block a student from seeing or selecting a retake subject.
        $nextTerm               = $this->computeNextAllowedTerm($student);
        $activelyEnrolledIds    = Enrollment::where('student_id', $student->student_id)
            ->where('academic_year', $nextTerm['academic_year'] ?? '')
            ->where('semester', $semester)
            ->where('status', 'Enrolled')
            ->whereNull('deleted_at')
            ->pluck('subject_id')
            ->toArray();

        // Get subject IDs with INC status (blocks prerequisites but doesn't count as passed)
        $incSubjectIds = $this->getIncSubjectIds($student);

        $available = [];

        foreach ($curriculumEntries as $entry) {
            $subjectId = $entry->subject_id;
            $subject = $entry->subject;

            if (!$subject) continue;

            // Skip if already passed or credited
            if (in_array($subjectId, $passedSubjectIds)) {
                continue;
            }

            // Check if already actively enrolled with status Enrolled
            $isActivelyEnrolled = in_array($subjectId, $activelyEnrolledIds);

            // ── Unresolved prerequisite check ──────────────────────────────────
            // If the curriculum row has codes that could not be resolved during seeding,
            // the subject is blocked regardless of passed subjects.
            // This prevents subjects from appearing eligible when their prerequisite
            // chain is known to be incomplete.
            $unresolvedPrereqs = $entry->unresolved_prerequisites ?? [];
            if (!empty($unresolvedPrereqs)) {
                $unresolvedDisplay = implode(', ', $unresolvedPrereqs);
                $available[] = [
                    'curriculum_id'        => $entry->id,
                    'subject_id'           => $subjectId,
                    'subject_code'         => $subject->code,
                    'subject_title'        => $subject->title,
                    'units'                => $subject->units,
                    'year_level'           => $entry->year_level,
                    'semester'             => $entry->semester,
                    'prerequisite_id'      => null,
                    'prerequisite_code'    => $unresolvedDisplay,
                    'prerequisite_status'  => 'unresolved',
                    'prerequisite_codes'   => $unresolvedPrereqs,
                    'prerequisite_display' => $unresolvedDisplay,
                    'missing_prerequisites' => $unresolvedPrereqs,
                    'eligible'             => false,
                    'is_retake'            => false,
                    'is_already_enrolled'  => $isActivelyEnrolled,
                    'blocked_reason'       =>
                        "Unresolved prerequisite: {$unresolvedDisplay}. " .
                        "Registrar must verify curriculum mapping before this subject can be enrolled.",
                ];
                continue; // Skip normal prereq logic for this entry
            }
            // ───────────────────────────────────────────────────────────────────

            // Prerequisite check
            $prereqStatus = 'none';
            $prereqCode = null;
            $eligible = true;
            $prereqCodes = [];
            $missingPrereqs = [];
            $prereqStatus = 'not_taken';
            $prereqDisplay = null;

            if ($entry->prerequisites->isNotEmpty()) {
                $requiredPrereqIds = $entry->prerequisites->pluck('id')->toArray();
                $prereqSubjects = $entry->prerequisites;
            } else {
                $legacyId = $entry->getAttributes()['prerequisite'] ?? null;
                if ($legacyId) {
                    $legacySubject = $entry->getRelationValue('prerequisite') ?? Subject::find($legacyId);
                    if ($legacySubject) {
                        $requiredPrereqIds = [$legacyId];
                        $prereqSubjects = collect([$legacySubject]);
                    } else {
                        $requiredPrereqIds = [];
                        $prereqSubjects = collect();
                    }
                } else {
                    $requiredPrereqIds = [];
                    $prereqSubjects = collect();
                }
            }

            if ($prereqSubjects->isNotEmpty()) {
                $prereqLogic = $entry->prerequisite_logic ?? 'AND';

                foreach ($prereqSubjects as $prereqSubject) {
                    $prereqCodes[] = $prereqSubject->code;
                }
                $prereqDisplay = implode(', ', $prereqCodes);

                if ($prereqLogic === 'OR') {
                    $passedPrereqs = array_intersect($requiredPrereqIds, $passedSubjectIds);
                    if (!empty($passedPrereqs)) {
                        $missingIds = []; // Satisfied
                    } else {
                        $missingIds = $requiredPrereqIds; // None satisfied
                    }
                } else {
                    // AND
                    $missingIds = array_diff($requiredPrereqIds, $passedSubjectIds);
                }

                if (empty($missingIds)) {
                    $prereqStatus = 'passed';
                } else {
                    $eligible = false;

                    // Check statuses for the missing prerequisites
                    $hasInc = !empty(array_intersect($missingIds, $incSubjectIds));

                    if ($hasInc) {
                        $prereqStatus = 'inc';
                    } else {
                        // Check if any missing prereq was failed/withdrawn/FDA
                        $hasFailed = Grade::where('student_id', $student->student_id)
                            ->whereIn('subject_id', $missingIds)
                            ->where(function ($q) {
                                $q->whereIn('status', self::RETAKE_STATUSES)
                                  ->orWhere(function ($inner) {
                                      $inner->where('grade_value', 5.00)
                                            ->whereNull('status');
                                  });
                            })
                            ->exists();

                        if ($hasFailed) {
                            $prereqStatus = 'failed';
                        }
                    }

                    foreach ($prereqSubjects as $prereqSubject) {
                        if (in_array($prereqSubject->id, $missingIds)) {
                            $missingPrereqs[] = $prereqSubject->code;
                        }
                    }
                }
            }

            // Determine if this is a retake subject
            $isRetake = false;
            $retakeGrade = Grade::where('student_id', $student->student_id)
                ->where('subject_id', $subjectId)
                ->where(function ($q) {
                    $q->whereIn('status', self::RETAKE_STATUSES)
                      ->orWhere(function ($inner) {
                          $inner->where('grade_value', 5.00)
                                ->whereNull('status');
                      });
                })
                ->first();

            if ($retakeGrade) {
                $isRetake = true;
            }

            $blockedReason = null;
            if (!$eligible) {
                if ($prereqStatus === 'inc') {
                    $missingDisplay = implode(', ', $missingPrereqs);
                    $blockedReason = "{$missingDisplay} has INC status. Complete the prerequisite first.";
                } else {
                    $prereqLogic = $entry->prerequisite_logic ?? 'AND';
                    if (count($missingPrereqs) > 1) {
                        if ($prereqLogic === 'OR') {
                            $blockedReason = "Required prerequisite: " . implode(' or ', $missingPrereqs) . ".";
                        } else {
                            $last = array_pop($missingPrereqs);
                            $blockedReason = "Required prerequisites: " . implode(' and ', $missingPrereqs) . " and " . $last . ".";
                            $missingPrereqs[] = $last; // Restore
                        }
                    } else {
                        $blockedReason = "Required prerequisite: " . implode('', $missingPrereqs) . ".";
                    }
                }
            } else if ($isActivelyEnrolled) {
                $blockedReason = 'Already actively enrolled in this subject.';
            }

            $available[] = [
                'curriculum_id' => $entry->id,
                'subject_id' => $subjectId,
                'subject_code' => $subject->code,
                'subject_title' => $subject->title,
                'units' => $subject->units,
                'year_level' => $entry->year_level,
                'semester' => $entry->semester,
                'prerequisite_id' => $entry->prerequisites->first()?->id, // Legacy compatibility
                'prerequisite_code' => $prereqDisplay, // Legacy compatibility
                'prerequisite_status' => $prereqStatus, // Legacy compatibility
                'prerequisite_codes' => $prereqCodes,
                'prerequisite_display' => $prereqDisplay,
                'missing_prerequisites' => $missingPrereqs,
                'eligible' => $eligible && !$isActivelyEnrolled,
                'is_retake' => $isRetake,
                'is_already_enrolled' => $isActivelyEnrolled,
                'blocked_reason' => $blockedReason,
            ];
        }

        return $available;
    }

    /**
     * Get subjects requiring retake across all terms.
     */
    public function getRetakeSubjects(Student $student): array
    {
        if (!$student->program_id) {
            return [];
        }

        // Find all grades with Failed, Withdrawn, or FDA status for this student
        $retakeGrades = Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->whereIn('status', self::RETAKE_STATUSES)
                  ->orWhere(function ($inner) {
                      $inner->where('grade_value', 5.00)
                            ->whereNull('status');
                  })
                  ->orWhereIn('remarks', ['FAILED', 'Failed', 'WITHDRAWN', 'Withdrawn', 'FDA']);
            })
            ->with('subject')
            ->get();

        // Exclude subjects that have been subsequently passed
        $passedIds = $this->getPassedSubjectIds($student);

        $retakes = [];
        foreach ($retakeGrades as $grade) {
            if (in_array($grade->subject_id, $passedIds)) {
                continue; // Already retaken and passed
            }

            $retakes[] = [
                'grade_id' => $grade->id,
                'subject_id' => $grade->subject_id,
                'subject_code' => $grade->subject?->code ?? '',
                'subject_title' => $grade->subject?->title ?? '',
                'units' => $grade->subject?->units ?? 0,
                'academic_year' => $grade->academic_year,
                'semester' => $grade->semester,
                'grade_value' => $grade->grade_value,
                'status' => $grade->status ?? $grade->remarks ?? 'Failed',
            ];
        }

        return $retakes;
    }

    /**
     * Get all enrollments grouped by (year_level, semester, academic_year).
     */
    public function getGroupedEnrollments(Student $student): array
    {
        $enrollments = Enrollment::where('student_id', $student->student_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['archived'])
            ->with('subject')
            ->orderBy('year_level')
            ->orderBy('semester')
            ->get();

        $groups = [];

        foreach ($enrollments as $enrollment) {
            $key = ($enrollment->year_level ?? 0) . '-' . $enrollment->semester . '-' . $enrollment->academic_year;

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'year_level' => $enrollment->year_level,
                    'semester' => $enrollment->semester,
                    'academic_year' => $enrollment->academic_year,
                    'subjects' => [],
                ];
            }

            // Get the grade for this enrollment
            $grade = Grade::where('student_id', $student->student_id)
                ->where('subject_id', $enrollment->subject_id)
                ->where('academic_year', $enrollment->academic_year)
                ->where('semester', $enrollment->semester)
                ->first();

            $groups[$key]['subjects'][] = [
                'enrollment_id' => $enrollment->id,
                'subject_id' => $enrollment->subject_id,
                'subject_code' => $enrollment->subject?->code ?? '',
                'subject_title' => $enrollment->subject?->title ?? '',
                'units' => $enrollment->subject?->units ?? 0,
                'enrollment_status' => $enrollment->status,
                'grade_id' => $grade?->id,
                'grade_value' => $grade?->grade_value,
                'grade_status' => $grade?->status ?? ($grade?->remarks ?? null),
                'remarks' => $grade?->remarks,
            ];
        }

        // Sort groups by term order
        usort($groups, function ($a, $b) {
            $aIdx = $this->getTermIndex($a['year_level'] ?? 0, $a['semester'] ?? 1);
            $bIdx = $this->getTermIndex($b['year_level'] ?? 0, $b['semester'] ?? 1);
            return $aIdx - $bIdx;
        });

        return array_values($groups);
    }

    /**
     * Build the full academic progress response.
     * Calls RetakeEligibilityService for all retake-related data and merges
     * semester-matching retake subjects into available_subjects so they appear
     * as selectable checkboxes in the enrollment UI.
     */
    public function getAcademicProgress(Student $student): array
    {
        $student->load('program');

        $allowedYears        = $this->computeAllowedAcademicYears($student);
        $nextTerm            = $this->computeNextAllowedTerm($student);
        $groupedEnrollments  = $this->getGroupedEnrollments($student);

        // ── Retake eligibility (delegated to RetakeEligibilityService) ──────
        $retakeService = app(RetakeEligibilityService::class);
        $retakeData    = $retakeService->getRetakeEligibility($student, $nextTerm);
        // ─────────────────────────────────────────────────────────────────────

        $availableSubjects = [];
        if ($nextTerm['can_add'] && $nextTerm['year_level'] && $nextTerm['semester']) {
            $availableSubjects = $this->getAvailableSubjects(
                $student,
                $nextTerm['year_level'],
                $nextTerm['semester']
            );
        }

        // ── Merge retake-available subjects into the enrollment checklist ────
        // Rule: ANY subject whose latest attempt is Failed/Withdrawn/FDA is
        // eligible for retake in any future term, as long as:
        //   1. It is not already present in $availableSubjects (duplicate guard).
        //   2. It is not already enrolled for the exact next AY + semester.
        //   3. Its own prerequisites (if any) are still met.
        $existingSubjectIds  = array_column($availableSubjects, 'subject_id');
        $retakePassedIds     = $this->getPassedSubjectIds($student);

        foreach ($retakeData['retake_subjects_available'] as $retakeSubj) {
            if (in_array($retakeSubj['subject_id'], $existingSubjectIds)) {
                continue; // Already in the regular curriculum list — skip
            }

            // ── Prerequisite check for this retake subject ──────────────────
            $prereqCodes    = [];
            $missingPrereqs = [];
            $retakeEligible = true;
            $blockedReason  = null;

            $prereqEntry = Curriculum::with(['prerequisites', 'prerequisite'])
                ->where('program_id', $student->program_id)
                ->where('subject_id', $retakeSubj['subject_id'])
                ->first();

            if ($prereqEntry) {
                if ($prereqEntry->prerequisites->isNotEmpty()) {
                    $reqPrereqIds  = $prereqEntry->prerequisites->pluck('id')->toArray();
                    $prereqSubjects = $prereqEntry->prerequisites;
                } else {
                    $legacyId = $prereqEntry->getAttributes()['prerequisite'] ?? null;
                    if ($legacyId) {
                        $legacySub     = $prereqEntry->getRelationValue('prerequisite') ?? Subject::find($legacyId);
                        $reqPrereqIds  = $legacySub ? [$legacyId] : [];
                        $prereqSubjects = $legacySub ? collect([$legacySub]) : collect();
                    } else {
                        $reqPrereqIds  = [];
                        $prereqSubjects = collect();
                    }
                }

                if (isset($prereqSubjects) && $prereqSubjects->isNotEmpty()) {
                    $prereqLogic = $prereqEntry->prerequisite_logic ?? 'AND';
                    foreach ($prereqSubjects as $ps) { $prereqCodes[] = $ps->code; }

                    if ($prereqLogic === 'OR') {
                        $passedPrereqs = array_intersect($reqPrereqIds, $retakePassedIds);
                        if (!empty($passedPrereqs)) {
                            $missingIds = [];
                        } else {
                            $missingIds = $reqPrereqIds;
                        }
                    } else {
                        $missingIds = array_diff($reqPrereqIds, $retakePassedIds);
                    }

                    if (!empty($missingIds)) {
                        $retakeEligible = false;
                        foreach ($prereqSubjects as $ps) {
                            if (in_array($ps->id, $missingIds)) { $missingPrereqs[] = $ps->code; }
                        }

                        if (count($missingPrereqs) > 1) {
                            if ($prereqLogic === 'OR') {
                                $blockedReason = "Required prerequisite: " . implode(' or ', $missingPrereqs) . ".";
                            } else {
                                $last = array_pop($missingPrereqs);
                                $blockedReason = "Required prerequisites: " . implode(' and ', $missingPrereqs) . " and " . $last . ".";
                                $missingPrereqs[] = $last; // Restore
                            }
                        } else {
                            $blockedReason = "Required prerequisite: " . implode('', $missingPrereqs) . ".";
                        }
                    }
                }
            }
            // ───────────────────────────────────────────────────────────────

            $availableSubjects[] = [
                'curriculum_id'          => null,
                'subject_id'             => $retakeSubj['subject_id'],
                'subject_code'           => $retakeSubj['subject_code'],
                'subject_title'          => $retakeSubj['subject_title'],
                'units'                  => $retakeSubj['units'],
                'year_level'             => $retakeSubj['curriculum_year_level'],
                'semester'               => $retakeSubj['curriculum_semester'],
                'prerequisite_id'        => null,
                'prerequisite_code'      => implode(', ', $prereqCodes) ?: null,
                'prerequisite_status'    => $retakeEligible ? 'passed' : 'not_taken',
                'prerequisite_codes'     => $prereqCodes,
                'prerequisite_display'   => implode(', ', $prereqCodes) ?: null,
                'missing_prerequisites'  => $missingPrereqs,
                'eligible'               => $retakeEligible,
                'is_retake'              => true,
                'is_already_enrolled'    => false,
                'blocked_reason'         => $blockedReason,
                'previous_academic_year' => $retakeSubj['previous_academic_year'],
                'previous_semester'      => $retakeSubj['previous_semester'],
                'previous_year_level'    => $retakeSubj['previous_year_level'],
                'previous_enrollment_id' => $retakeSubj['previous_enrollment_id'],
                'latest_status'          => $retakeSubj['latest_status'],
                'grade_value'            => $retakeSubj['grade_value'],
                'remarks'                => $retakeSubj['remarks'] ?? null,
            ];
        }
        // ─────────────────────────────────────────────────────────────────────

        return [
            'student_id'                  => $student->student_id,
            'program'                     => $student->program?->code ?? null,
            'program_name'                => $student->program?->name ?? null,
            'enrollment_date'             => $student->enrollment_date?->toDateString(),
            'graduation_date'             => $student->graduation_date?->toDateString(),
            'allowed_academic_years'      => $allowedYears,
            'next_allowed_term'           => $nextTerm,
            'grouped_enrollments'         => $groupedEnrollments,
            'available_subjects'          => $availableSubjects,
            // Legacy key kept for backward compatibility:
            'retake_subjects'             => $retakeData['retake_subjects_required'],
            // New structured retake keys:
            'retake_subjects_required'    => $retakeData['retake_subjects_required'],
            'retake_subjects_available'   => $retakeData['retake_subjects_available'],
            'inc_subjects'                => $retakeData['inc_subjects'],
        ];
    }

    /**
     * Validate subjects for adding to the next term.
     *
     * @param  Student $student
     * @param  array   $subjectIds       Regular (new) subjects for the next curriculum term
     * @param  array   $retakeSubjectIds Subjects the registrar wants to retake (previously Failed/Withdrawn/FDA)
     *
     * Returns [valid => bool, errors => [...], data => [...]]
     * where data.subject_ids   = validated regular subject IDs
     *       data.retake_ids    = validated retake subject IDs
     */
    public function validateAddNextTerm(Student $student, array $subjectIds, array $retakeSubjectIds = []): array
    {
        $nextTerm = $this->computeNextAllowedTerm($student);

        if (!$nextTerm['can_add']) {
            return [
                'valid'  => false,
                'errors' => [$nextTerm['blocking_reason']],
            ];
        }

        $yearLevel    = $nextTerm['year_level'];
        $semester     = $nextTerm['semester'];
        $academicYear = $nextTerm['academic_year'];

        // ── Auto-classify: separate retake subjects from regular subjects ────
        // When the frontend sends a flat list of subject_ids (all checked boxes
        // from the merged available_subjects table), we need to automatically
        // split out any that are retake candidates so they pass the correct
        // validation path instead of being rejected as "not in curriculum Y/S".
        $retakeService       = app(RetakeEligibilityService::class);
        $eligibility         = $retakeService->getRetakeEligibility($student, $nextTerm);
        $availableRetakeIds  = array_column($eligibility['retake_subjects_available'], 'subject_id');

        $autoDetectedRetakeIds = [];
        $regularSubjectIds     = [];

        foreach ($subjectIds as $subjectId) {
            if (in_array($subjectId, $availableRetakeIds)) {
                $autoDetectedRetakeIds[] = $subjectId;
            } else {
                $regularSubjectIds[] = $subjectId;
            }
        }

        // Merge explicitly passed retake IDs with auto-detected ones (deduplicated)
        $allRetakeIds = array_values(array_unique(array_merge($autoDetectedRetakeIds, $retakeSubjectIds)));
        // ─────────────────────────────────────────────────────────────────────

        // ── Regular subjects ─────────────────────────────────────────────────
        $validCurriculumIds = Curriculum::where('program_id', $student->program_id)
            ->where('year_level', $yearLevel)
            ->where('semester', $semester)
            ->pluck('subject_id')
            ->toArray();

        $passedSubjectIds = $this->getPassedSubjectIds($student);
        $errors           = [];
        $validatedIds     = [];

        foreach ($regularSubjectIds as $subjectId) {
            $subject = Subject::find($subjectId);
            $code    = $subject?->code ?? "Subject #{$subjectId}";

            // Must belong to curriculum for this term
            if (!in_array($subjectId, $validCurriculumIds)) {
                $errors[] = "{$code} does not belong to the curriculum for Year {$yearLevel}, Semester {$semester}.";
                continue;
            }

            // Must not be already passed/credited
            if (in_array($subjectId, $passedSubjectIds)) {
                $errors[] = "{$code} has already been passed or credited.";
                continue;
            }

            // Must not have active enrollment in the same AY + semester
            $activeExists = Enrollment::where('student_id', $student->student_id)
                ->where('subject_id', $subjectId)
                ->where('academic_year', $academicYear)
                ->where('semester', $semester)
                ->whereNull('deleted_at')
                ->whereNotIn('status', ['Cancelled', 'archived'])
                ->exists();

            if ($activeExists) {
                $errors[] = "{$code} already has an active enrollment for A.Y. {$academicYear}, Semester {$semester}.";
                continue;
            }

            // Prerequisite check
            $prereqEntry = Curriculum::with(['prerequisites', 'prerequisite'])
                ->where('program_id', $student->program_id)
                ->where('subject_id', $subjectId)
                ->first();

            if ($prereqEntry) {
                $unresolvedPrereqs = $prereqEntry->unresolved_prerequisites ?? [];
                if (!empty($unresolvedPrereqs)) {
                    $unresolvedDisplay = implode(', ', $unresolvedPrereqs);
                    $errors[] = "{$code} cannot be enrolled: unresolved prerequisite(s) '{$unresolvedDisplay}'. " .
                                "Registrar must verify curriculum mapping.";
                    continue;
                }

                if ($prereqEntry->prerequisites->isNotEmpty()) {
                    $requiredPrereqIds = $prereqEntry->prerequisites->pluck('id')->toArray();
                    $prereqSubjects    = $prereqEntry->prerequisites;
                } else {
                    $legacyId = $prereqEntry->getAttributes()['prerequisite'] ?? null;
                    if ($legacyId) {
                        $legacySubject = $prereqEntry->getRelationValue('prerequisite') ?? Subject::find($legacyId);
                        if ($legacySubject) {
                            $requiredPrereqIds = [$legacyId];
                            $prereqSubjects    = collect([$legacySubject]);
                        } else {
                            $requiredPrereqIds = [];
                            $prereqSubjects    = collect();
                        }
                    } else {
                        $requiredPrereqIds = [];
                        $prereqSubjects    = collect();
                    }
                }

                if ($prereqSubjects->isNotEmpty()) {
                    $prereqLogic = $prereqEntry->prerequisite_logic ?? 'AND';

                    if ($prereqLogic === 'OR') {
                        $passedPrereqs = array_intersect($requiredPrereqIds, $passedSubjectIds);
                        if (!empty($passedPrereqs)) {
                            $missingIds = [];
                        } else {
                            $missingIds = $requiredPrereqIds;
                        }
                    } else {
                        $missingIds = array_diff($requiredPrereqIds, $passedSubjectIds);
                    }

                    if (!empty($missingIds)) {
                        $missingCodes = [];
                        foreach ($prereqSubjects as $prereqSubject) {
                            if (in_array($prereqSubject->id, $missingIds)) {
                                $missingCodes[] = $prereqSubject->code;
                            }
                        }

                        if (count($missingCodes) > 1) {
                            if ($prereqLogic === 'OR') {
                                $missingDisplay = implode(' or ', $missingCodes);
                            } else {
                                $last = array_pop($missingCodes);
                                $missingDisplay = implode(' and ', $missingCodes) . " and " . $last;
                                $missingCodes[] = $last; // Restore
                            }
                        } else {
                            $missingDisplay = implode('', $missingCodes);
                        }

                        $errors[] = "{$missingDisplay} must be completed (Passed/Credited) before enrolling in {$code}.";
                        continue;
                    }
                }
            }

            $validatedIds[] = $subjectId;
        }

        // ── Retake subjects ──────────────────────────────────────────────────
        $validatedRetakeIds = [];
        if (!empty($allRetakeIds)) {
            $retakeResult       = $retakeService->validateRetakeSubjects($student, $allRetakeIds, $nextTerm);
            $validatedRetakeIds = $retakeResult['valid_ids'];
            $errors             = array_merge($errors, $retakeResult['errors']);
        }
        // ─────────────────────────────────────────────────────────────────────

        if (!empty($errors)) {
            return [
                'valid'  => false,
                'errors' => $errors,
            ];
        }

        if (empty($validatedIds) && empty($validatedRetakeIds)) {
            return [
                'valid'  => false,
                'errors' => ['No valid subjects to enroll.'],
            ];
        }

        return [
            'valid'  => true,
            'errors' => [],
            'data'   => [
                'subject_ids'   => $validatedIds,
                'retake_ids'    => $validatedRetakeIds,
                'year_level'    => $yearLevel,
                'semester'      => $semester,
                'academic_year' => $academicYear,
            ],
        ];
    }

    /**
     * Auto-generate remarks based on grade_value and/or status.
     */
    public function autoGenerateRemarks(?float $gradeValue, ?string $status): string
    {
        if ($status) {
            $upper = ucfirst(strtolower($status));
            if (in_array($upper, ['Withdrawn', 'Fda', 'Credited', 'Cancelled'])) {
                return $upper === 'Fda' ? 'FDA' : $upper;
            }
        }

        if ($gradeValue !== null) {
            if ($gradeValue >= 1.00 && $gradeValue <= 3.00) {
                return 'Passed';
            }
            if (abs($gradeValue - 4.00) < 0.001) {
                return 'INC';
            }
            if (abs($gradeValue - 5.00) < 0.001) {
                return 'Failed';
            }
        }

        if ($status === 'INC') {
            return 'INC';
        }

        return '';
    }

    /**
     * Auto-determine status from grade value.
     */
    public function autoStatusFromGrade(?float $gradeValue, ?string $explicitStatus): string
    {
        // If explicit status provided, use it
        if ($explicitStatus && in_array($explicitStatus, ['Passed', 'Failed', 'INC', 'Withdrawn', 'FDA', 'Credited', 'Enrolled', 'Cancelled'])) {
            return $explicitStatus;
        }

        if ($gradeValue !== null) {
            if ($gradeValue >= 1.00 && $gradeValue <= 3.00) {
                return 'Passed';
            }
            if (abs($gradeValue - 4.00) < 0.001) {
                return 'INC';
            }
            if (abs($gradeValue - 5.00) < 0.001) {
                return 'Failed';
            }
        }

        return 'Enrolled';
    }

    // ── Private helpers ─────────────────────────────────────────────────

    /**
     * Get all subject IDs the student has passed or credited.
     */
    private function getPassedSubjectIds(Student $student): array
    {
        return Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->whereIn('status', self::PASSED_STATUSES)
                  ->orWhere(function ($inner) {
                      // Legacy: grade 1.00-3.00 without status column
                      $inner->whereNotNull('grade_value')
                            ->where('grade_value', '>=', 1.00)
                            ->where('grade_value', '<=', 3.00)
                            ->whereNull('status');
                  })
                  ->orWhere(function ($inner) {
                      // Legacy: remarks-based
                      $inner->whereNull('status')
                            ->whereIn('remarks', ['PASSED', 'Passed', 'CREDITED', 'Credited']);
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->toArray();
    }

    /**
     * Get all subject IDs with INC status.
     */
    private function getIncSubjectIds(Student $student): array
    {
        return Grade::where('student_id', $student->student_id)
            ->where(function ($q) {
                $q->where('status', 'INC')
                  ->orWhere(function ($inner) {
                      $inner->whereNull('status')
                            ->where(function ($sub) {
                                $sub->where('grade_value', 4.00)
                                    ->orWhereIn('remarks', ['INC', 'inc']);
                            });
                  });
            })
            ->pluck('subject_id')
            ->unique()
            ->toArray();
    }

    /**
     * Get the index of a term in TERM_ORDER.
     */
    private function getTermIndex(int $yearLevel, int $semester): int
    {
        foreach (self::TERM_ORDER as $index => $term) {
            if ($term['year_level'] === $yearLevel && $term['semester'] === (int) $semester) {
                return $index;
            }
        }
        return 999; // unknown term sorts last
    }

    /**
     * Helper: ordinal number string.
     */
    private function ordinal(int $number): string
    {
        $suffixes = ['th', 'st', 'nd', 'rd'];
        $lastTwo = $number % 100;
        $suffix = ($lastTwo >= 11 && $lastTwo <= 13) ? 'th' : ($suffixes[min($number % 10, 4)] ?? 'th');
        return $number . $suffix;
    }
}
