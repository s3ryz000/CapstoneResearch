<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * BSTM Curriculum Seeder
 *
 * Bachelor of Science in Tourism Management
 * Based on CMO No. 62, Series of 2017 and CMO No. 20, Series of 2013
 *
 * Each row:
 *   code, title, units, year_level, semester, prerequisites (array of codes), description (optional)
 *
 * prerequisites MUST use the exact subject codes as they appear in this program's own rows.
 * Multi-prerequisite uses PHP arrays, not slash strings.
 */
class BstmCurriculumSeeder extends Seeder
{
    use CurriculumSeederHelper;

    public function run(): void
    {
        $rows = [

            // ═══════════════════════════════════════
            // FIRST YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 1',
                'title' => 'Purposive Communication',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'GE 2',
                'title' => 'Readings in Philippine History',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'GE 3',
                'title' => 'Mathematics in the Modern World',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'THC 1',
                'title' => 'Macro Perspective of Tourism and Hospitality',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'THC 2',
                'title' => 'Risk Management as Applied to Safety, Security, and Sanitation',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'PATHFit 1',
                'title' => 'Movement Competency Training',
                'units' => 2,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],
            [
                'code' => 'NSTP 1',
                'title' => 'CWTS/LTS/ROTC 1',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // FIRST YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'TPC 1',
                'title' => 'Global Tourism, Geography, and Culture',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'THC 3',
                'title' => 'Tourism and Hospitality Service Quality Management',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'THC 4',
                'title' => 'Philippine Tourism, Geography, and Culture',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['GE 2', 'THC 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'THC 5',
                'title' => 'Tourism and Hospitality 2 (Micro Perspective of Tourism and Hospitality)',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'TPC 2',
                'title' => 'Tour and Travel Management',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 2',
                'title' => 'Exercise-Based Fitness Activities',
                'units' => 2,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['PATHFit 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],
            [
                'code' => 'NSTP 2',
                'title' => 'CWTS/LTS/ROTC 2',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['NSTP 1'],
                'description' => 'BSTM - First Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // SECOND YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 4',
                'title' => 'Understanding the Self',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 1',
                'title' => 'Gender and Society',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['GE 2'],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 4',
                'title' => 'Living in the IT Era',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'TPC 3',
                'title' => 'Sustainable Tourism',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'HMPE 1',
                'title' => 'Recreation and Leisure Management',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['THC 5'],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 2',
                'title' => 'Environmental Science',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - First Semester',
            ],
            [
                'code' => 'PATHFit 3',
                'title' => 'Physical Activities towards Health and Fitness 3 (Badminton)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['PATHFit 1', 'PATHFit 2'],
                'description' => 'BSTM - Second Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // SECOND YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 5',
                'title' => 'Science, Technology, and Society',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['GE ELECT 2'],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'GE 6',
                'title' => 'Ethics',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['GE 4'],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'TPC 4',
                'title' => 'Tourism Policy Planning and Development',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['THC 5'],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'TPC 5',
                'title' => 'Introduction to MICE',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['TPC 1'],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'HMPE 2',
                'title' => 'Bar and Beverage Management with Lab',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'TPC 6',
                'title' => 'Foreign Language 1',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSTM - Second Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 4',
                'title' => 'Physical Activities towards Health and Fitness 4 (Basketball)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['PATHFit 3'],
                'description' => 'BSTM - Second Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 7',
                'title' => 'The Contemporary World',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSTM - Third Year - First Semester',
            ],
            [
                'code' => 'TPC 8',
                'title' => 'Research in Tourism',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE 1'],
                'description' => 'BSTM - Third Year - First Semester',
            ],
            [
                'code' => 'HMPE 3',
                'title' => 'Front Office Operation',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['HMPE 1'],
                'description' => 'BSTM - Third Year - First Semester',
            ],
            [
                'code' => 'BME 1',
                'title' => 'Operations Management in TH Industry',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - Third Year - First Semester',
            ],
            [
                'code' => 'THC 6',
                'title' => 'Professional Development and Applied Ethics',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE 6'],
                'description' => 'BSTM - Third Year - First Semester',
            ],
            [
                'code' => 'THC 7',
                'title' => 'Tourism and Hospitality Marketing',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - Third Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'THC 8',
                'title' => 'Legal Aspects in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['THC 1', 'THC 2'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'GE ELECT 3',
                'title' => 'PEACE Education',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['GE ELECT 2', 'TPC 3', 'GE 6'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'BME 2',
                'title' => 'Strategic Management in Tourism and Hospitality 1',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'HMPE 4',
                'title' => 'Housekeeping Operation',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['HMPE 3'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'THC 9',
                'title' => 'Multicultural Diversity in Workplace for the Tourism Professional',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['THC 4'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'GE ELECT 5',
                'title' => 'Entrepreneurial Mind',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],
            [
                'code' => 'TPC 7',
                'title' => 'Transportation Management',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['THC 1', 'THC 2'],
                'description' => 'BSTM - Third Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // FOURTH YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'HMPE 5',
                'title' => 'Food and Beverage Service with Lab',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['HMPE 2'],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],
            [
                'code' => 'RIZAL',
                'title' => 'Life and Works of Rizal',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],
            [
                'code' => 'TPC 9',
                'title' => 'Foreign Language 2',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['TPC 6'],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],
            [
                'code' => 'TPC 10',
                'title' => 'Applied Business Tools Technology in Tourism with Lab',
                'units' => 4,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['GE ELECT 4'],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],
            [
                'code' => 'THC 10',
                'title' => 'Entrepreneurship in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['THC 1', 'GE ELECT 5'],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],
            [
                'code' => 'GE 8',
                'title' => 'Art Appreciation',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSTM - Fourth Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // FOURTH YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'PRACTICUM',
                'title' => 'Practicum in Tourism and Hospitality Industry',
                'units' => 6,
                'year_level' => 4,
                'semester' => 2,
                // Special: "Finished all Academic Requirements" — skip as relational prereq.
                // The helper will warn and skip this.
                'prerequisites' => ['Finished all Academic Requirements'],
                'description' => 'BSTM - Fourth Year - Second Semester',
            ],
        ];

        $this->seedProgramCurriculum('BSTM', $rows);
    }
}
