<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * BSE Curriculum Seeder
 *
 * Bachelor of Science in Entrepreneurship
 * Based on CMO No. 18, Series of 2017 and CMO No. 20, Series of 2013
 *
 * IMPORTANT: BSE uses GE codes with completely different titles from BSTM/BSHM:
 *   GE 1 (BSE) = "Understanding the Self"      (BSTM/BSHM = "Purposive Communication")
 *   GE 2 (BSE) = "Readings in Philippine History"  (same title — will reuse same subjects row)
 *   GE 3 (BSE) = "The Contemporary World"      (BSTM/BSHM = "Mathematics in the Modern World")
 *   GE 4 (BSE) = "Mathematics in the Modern World" (BSTM/BSHM = "Understanding the Self")
 *   GE 5 (BSE) = "Purposive Communication"     (BSTM/BSHM = "Science, Technology, and Society")
 *   GE 6 (BSE) = "Art Appreciation"            (BSTM = "Ethics")
 *   GE ELECT 1 (BSE) = "Social Science and Philosophy"  (BSTM/BSHM = "Gender and Society")
 *   GE ELECT 2 (BSE) = "Arts and Humanities"   (BSHM = "Environmental Science")
 *
 * These will each become separate subjects rows due to (code, title) lookup key.
 *
 * Unresolved prerequisite notes:
 *   - OM: old data had "MGT/HRM/ACCTG" — resolved to ['MGT 1', 'HRM', 'ACCTG 2'] per curriculum context
 *   - ELT 3: resolved to ['OM', 'ELT 1', 'ELT 2'] (curriculum section reference)
 *   - ENT 12: resolved to ['OM', 'ELT 1', 'STRAMA']
 *   - ENT 13: old data had "STRAMA/ELT" — "ELT" alone is not a defined code; resolved to ['STRAMA']
 *             A warning will be logged for the missing 'ELT' alias.
 *   - ENT 5: old subject section had ENT 3/ENT 4 but curriculum section used just ENT 4 — using ['ENT 4']
 */
class BseCurriculumSeeder extends Seeder
{
    use CurriculumSeederHelper;

    public function run(): void
    {
        $rows = [

            // ═══════════════════════════════════════
            // FIRST YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            // BSE GE 1 = "Understanding the Self" (different from BSTM/BSHM GE 1)
            [
                'code' => 'GE 1',
                'title' => 'Understanding the Self',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            [
                'code' => 'GE 2',
                'title' => 'Readings in Philippine History',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            // BSE GE 3 = "The Contemporary World" (different from BSTM/BSHM GE 3)
            [
                'code' => 'GE 3',
                'title' => 'The Contemporary World',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            [
                'code' => 'ENT 1',
                'title' => 'Entrepreneurial Behavior',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            [
                'code' => 'MGT 1',
                'title' => 'Principles of Management',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            [
                'code' => 'PATHFit 1',
                'title' => 'Movement Competency Training',
                'units' => 2,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],
            [
                'code' => 'NSTP 1',
                'title' => 'CWTS/LTS/ROTC 1',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - First Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // FIRST YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            // BSE GE 4 = "Mathematics in the Modern World"
            [
                'code' => 'GE 4',
                'title' => 'Mathematics in the Modern World',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSE - First Year - Second Semester',
            ],
            [
                'code' => 'ENT 2',
                'title' => 'Microeconomics',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['ENT 1'],
                'description' => 'BSE - First Year - Second Semester',
            ],
            [
                'code' => 'MKG 1',
                'title' => 'Principles of Marketing',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['MGT 1'],
                'description' => 'BSE - First Year - Second Semester',
            ],
            // BSE GE 5 = "Purposive Communication"
            [
                'code' => 'GE 5',
                'title' => 'Purposive Communication',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSE - First Year - Second Semester',
            ],
            // BSE GE 6 = "Art Appreciation"
            [
                'code' => 'GE 6',
                'title' => 'Art Appreciation',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSE - First Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 2',
                'title' => 'Exercise-Based Fitness Activities',
                'units' => 2,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['PATHFit 1'],
                'description' => 'BSE - First Year - Second Semester',
            ],
            [
                'code' => 'NSTP 2',
                'title' => 'CWTS/LTS/ROTC 2',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['NSTP 1'],
                'description' => 'BSE - First Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // SECOND YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 7',
                'title' => 'Science, Technology, and Society',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - Second Year - First Semester',
            ],
            [
                'code' => 'GE 8',
                'title' => 'Ethics',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - Second Year - First Semester',
            ],
            [
                'code' => 'ENT 3',
                'title' => 'Opportunity Seeking',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['ENT 2'],
                'description' => 'BSE - Second Year - First Semester',
            ],
            [
                'code' => 'ENT 4',
                'title' => 'Market Research and Consumer Behavior',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['MKG 1'],
                'description' => 'BSE - Second Year - First Semester',
            ],
            // BSE GE ELECT 1 = "Social Science and Philosophy" (different from BSTM/BSHM)
            [
                'code' => 'GE ELECT 1',
                'title' => 'Social Science and Philosophy',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - Second Year - First Semester',
            ],
            [
                'code' => 'ACCTG 1',
                'title' => 'Accounting, Business, and Management 1',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - Second Year - First Semester',
            ],
            [
                'code' => 'PATHFit 3',
                'title' => 'Physical Activities towards Health and Fitness 3 (Badminton)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['PATHFit 1', 'PATHFit 2'],
                'description' => 'BSE - Second Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // SECOND YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            // BSE GE ELECT 2 = "Arts and Humanities" (different from BSHM's "Environmental Science")
            [
                'code' => 'GE ELECT 2',
                'title' => 'Arts and Humanities',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            // ENT 5 prereq: curriculum section used ENT 4 only
            [
                'code' => 'ENT 5',
                'title' => 'Social Entrepreneurship',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisite_logic' => 'OR',
                'prerequisites' => ['ENT 3', 'ENT 4'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            [
                'code' => 'ENT 6',
                'title' => 'Innovation Management',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisite_logic' => 'OR',
                'prerequisites' => ['ENT 4', 'ENT 5'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            // ENT 7 prereq: curriculum section used ENT 1 (not ACCTG 1 from subject section)
            [
                'code' => 'ENT 7',
                'title' => 'Pricing and Costing',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['ACCTG 1'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            [
                'code' => 'HRM',
                'title' => 'Human Resources Management',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['MGT 1', 'ENT 1'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            [
                'code' => 'ACCTG 2',
                'title' => 'Accounting, Business, and Management 2',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['ACCTG 1'],
                'description' => 'BSE - Second Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 4',
                'title' => 'Physical Activities towards Health and Fitness 4 (Basketball)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['PATHFit 3'],
                'description' => 'BSE - Second Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'ENT 8',
                'title' => 'Financial Management (Financial Analysis for Decision Making)',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['ENT 7', 'ACCTG 2'],
                'description' => 'BSE - Third Year - First Semester',
            ],
            // OM prereq: resolved from "MGT/HRM/ACCTG" → ['MGT 1', 'HRM', 'ACCTG 2']
            [
                'code' => 'OM',
                'title' => 'Operations Management',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['MGT 1', 'HRM', 'ACCTG 2'],
                'description' => 'BSE - Third Year - First Semester',
            ],
            [
                'code' => 'HUM 1',
                'title' => 'Philippine Popular Culture',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE ELECT 2'],
                'description' => 'BSE - Third Year - First Semester',
            ],
            // MOE 1 prereq: curriculum section used MKG 1 (not ACCTG 2 from subject section)
            [
                'code' => 'MOE 1',
                'title' => 'Microsoft Productivity Tool 1',
                'units' => 2,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['MKG 1'],
                'description' => 'BSE - Third Year - First Semester',
            ],
            [
                'code' => 'ELT 1',
                'title' => 'Hospitality Management',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['MGT 1'],
                'description' => 'BSE - Third Year - First Semester',
            ],
            // ELT 2 had no prereq in the curriculum section
            [
                'code' => 'ELT 2',
                'title' => 'Events Management',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSE - Third Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'ENT 9',
                'title' => 'Business Plan Preparation',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['ENT 8'],
                'description' => 'BSE - Third Year - Second Semester',
            ],
            [
                'code' => 'STRAMA',
                'title' => 'Strategic Management',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['OM'],
                'description' => 'BSE - Third Year - Second Semester',
            ],
            [
                'code' => 'MOE 2',
                'title' => 'Microsoft Productivity Tool 2',
                'units' => 2,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['MOE 1'],
                'description' => 'BSE - Third Year - Second Semester',
            ],
            // ELT 3 prereq: resolved to ['OM', 'ELT 1', 'ELT 2'] from curriculum section
            [
                'code' => 'ELT 3',
                'title' => 'Managing a Service Enterprise',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['OM', 'ELT 1', 'ELT 2'],
                'description' => 'BSE - Third Year - Second Semester',
            ],
            [
                'code' => 'ELT 4',
                'title' => 'Entrepreneurial Leadership in an Organization',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['ENT 1'],
                'description' => 'BSE - Third Year - Second Semester',
            ],
            [
                'code' => 'MDA',
                'title' => 'Multimedia Development Application',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['MOE 1'],
                'description' => 'BSE - Third Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // FOURTH YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'LAW',
                'title' => 'Business Law and Taxation',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['ACCTG 2'],
                'description' => 'BSE - Fourth Year - First Semester',
            ],
            [
                'code' => 'GE 9',
                'title' => 'Life and Works of Rizal',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSE - Fourth Year - First Semester',
            ],
            [
                'code' => 'ENT 10',
                'title' => 'Business Plan Implementation 1',
                'units' => 5,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['ENT 9'],
                'description' => 'BSE - Fourth Year - First Semester',
            ],
            [
                'code' => 'MIS',
                'title' => 'Management Information System',
                'units' => 5,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['MOE 2'],
                'description' => 'BSE - Fourth Year - First Semester',
            ],
            [
                'code' => 'ELT 5',
                'title' => 'Entrepreneurial Marketing Strategies',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['ELT 4'],
                'description' => 'BSE - Fourth Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // FOURTH YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'ENT 11',
                'title' => 'Business Plan Implementation 2',
                'units' => 5,
                'year_level' => 4,
                'semester' => 2,
                'prerequisites' => ['ENT 10'],
                'description' => 'BSE - Fourth Year - Second Semester',
            ],
            // ENT 12 prereq: resolved from "OM/ELT 4/STRAMA" → ['OM', 'ELT 1', 'STRAMA']
            // Note: "ELT 4" in old subject note vs "ELT 1" in curriculum note — using ['OM', 'ELT 1', 'STRAMA']
            [
                'code' => 'ENT 12',
                'title' => 'International Business and Trade',
                'units' => 3,
                'year_level' => 4,
                'semester' => 2,
                'prerequisites' => ['OM', 'ELT 1', 'STRAMA'],
                'description' => 'BSE - Fourth Year - Second Semester',
            ],
            // ENT 13 prereq: old string was "STRAMA/ELT" — "ELT" alone is not a defined code.
            // Resolved to ['STRAMA'] only. Helper will log a warning for 'ELT' not found.
            [
                'code' => 'ENT 13',
                'title' => 'Programs and Policies on Enterprise Development',
                'units' => 3,
                'year_level' => 4,
                'semester' => 2,
                'prerequisites' => ['STRAMA'],
                'description' => 'BSE - Fourth Year - Second Semester',
            ],
        ];

        $this->seedProgramCurriculum('BSE', $rows);
    }
}
