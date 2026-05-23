<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * BSHM Curriculum Seeder
 *
 * Bachelor of Science in Hospitality Management
 * Based on CMO No. 62, Series of 2017 and CMO No. 20, Series of 2013
 *
 * NOTE: Several BSHM subject codes overlap with BSTM codes but have DIFFERENT titles.
 * Examples:
 *   THC 3 (BSHM) = "Quality Service Management in Tourism and Hospitality"
 *   THC 3 (BSTM) = "Tourism and Hospitality Service Quality Management"
 *   THC 5 (BSHM) = "Micro Perspective of Tourism and Hospitality"
 *   THC 5 (BSTM) = "Tourism and Hospitality 2 (Micro Perspective of Tourism and Hospitality)"
 *   GE 5  (BSHM) = "Indigenous People"
 *   GE 5  (BSTM) = "Science, Technology, and Society"
 *   HMPE 1 (BSHM) = "Introduction to Transport Services"
 *   HMPE 1 (BSTM) = "Recreation and Leisure Management"
 *
 * These will correctly become separate subjects rows because the helper uses (code, title) as the lookup key.
 */
class BshmCurriculumSeeder extends Seeder
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
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'GE 2',
                'title' => 'Readings in Philippine History',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'GE 3',
                'title' => 'Mathematics in the Modern World',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'THC 1',
                'title' => 'Macro Perspective of Tourism and Hospitality',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'THC 2',
                'title' => 'Risk Management as Applied to Safety, Security, and Sanitation',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'PATHFit 1',
                'title' => 'Movement Competency Training',
                'units' => 2,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],
            [
                'code' => 'NSTP 1',
                'title' => 'CWTS/LTS/ROTC 1',
                'units' => 3,
                'year_level' => 1,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - First Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // FIRST YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            // NOTE: THC 3 title differs from BSTM's THC 3
            [
                'code' => 'THC 3',
                'title' => 'Quality Service Management in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 2'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            [
                'code' => 'THC 4',
                'title' => 'Philippine Tourism, Geography, and Culture',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['GE 2', 'THC 1'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            // NOTE: THC 5 title differs slightly from BSTM's THC 5
            [
                'code' => 'THC 5',
                'title' => 'Micro Perspective of Tourism and Hospitality',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            [
                'code' => 'HPC 1',
                'title' => 'Kitchen Essentials & Basic Food Preparation',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 2'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            [
                'code' => 'HPC 2',
                'title' => 'Fundamentals in Lodging Operations',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['THC 1'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 2',
                'title' => 'Exercise-Based Fitness Activities',
                'units' => 2,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['PATHFit 1'],
                'description' => 'BSHM - First Year - Second Semester',
            ],
            [
                'code' => 'NSTP 2',
                'title' => 'CWTS/LTS/ROTC 2',
                'units' => 3,
                'year_level' => 1,
                'semester' => 2,
                'prerequisites' => ['NSTP 1'],
                'description' => 'BSHM - First Year - Second Semester',
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
                'description' => 'BSHM - Second Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 1',
                'title' => 'Gender and Society',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['GE 2'],
                'description' => 'BSHM - Second Year - First Semester',
            ],
            [
                'code' => 'HPC 3',
                'title' => 'Applied Business Tools and Technologies (PMS) with Lab',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - Second Year - First Semester',
            ],
            [
                'code' => 'HPC 4',
                'title' => 'Supply Chain Management in Hospitality Industry',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['THC 3'],
                'description' => 'BSHM - Second Year - First Semester',
            ],
            [
                'code' => 'HPC 5',
                'title' => 'Foreign Language 1',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - Second Year - First Semester',
            ],
            [
                'code' => 'PATHFit 3',
                'title' => 'Physical Activities towards Health and Fitness 3 (Badminton)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => ['PATHFit 1', 'PATHFit 2'],
                'description' => 'BSHM - Second Year - First Semester',
            ],
            // NOTE: GE 5 (BSHM) = "Indigenous People" — different title from BSTM
            [
                'code' => 'GE 5',
                'title' => 'Indigenous People',
                'units' => 3,
                'year_level' => 2,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - Second Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // SECOND YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            [
                'code' => 'GE 6',
                'title' => 'Science, Technology, and Society',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            [
                'code' => 'GE 7',
                'title' => 'Ethics',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            [
                'code' => 'HPC 6',
                'title' => 'Fundamentals in Food Service Operations',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['HPC 1'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            [
                'code' => 'HPC 7',
                'title' => 'Introduction to MICE',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['THC 5'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            // NOTE: HMPE 1 (BSHM) = "Introduction to Transport Services" — different from BSTM
            [
                'code' => 'HMPE 1',
                'title' => 'Introduction to Transport Services',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => [],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            [
                'code' => 'HPC 8',
                'title' => 'Foreign Language 2',
                'units' => 3,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['HPC 5'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],
            [
                'code' => 'PATHFit 4',
                'title' => 'Physical Activities towards Health and Fitness 4 (Basketball)',
                'units' => 2,
                'year_level' => 2,
                'semester' => 2,
                'prerequisites' => ['PATHFit 3'],
                'description' => 'BSHM - Second Year - Second Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — FIRST SEMESTER
            // ═══════════════════════════════════════
            // NOTE: GE 8 (BSHM) = "The Contemporary World" — different from BSTM (which doesn't have GE 8 in Y3)
            [
                'code' => 'GE 8',
                'title' => 'The Contemporary World',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE ELECT 1'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            // NOTE: HMPE 2 (BSHM) = "Bar and Beverage Management with Laboratory" — different from BSTM
            [
                'code' => 'HMPE 2',
                'title' => 'Bar and Beverage Management with Laboratory',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['HPC 6'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            [
                'code' => 'HMPE 3',
                'title' => 'Front Office Operation',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['THC 5'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            // NOTE: BME 1 (BSHM) has longer title variant; treated as same subject if title matches
            [
                'code' => 'BME 1',
                'title' => 'Operations Management in Tourism and Hospitality Industry',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['THC 3'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            [
                'code' => 'THC 6',
                'title' => 'Professional Development and Applied Ethics',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE 6'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            [
                'code' => 'THC 7',
                'title' => 'Tourism and Hospitality Marketing',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['THC 3'],
                'description' => 'BSHM - Third Year - First Semester',
            ],
            [
                'code' => 'HPC 10',
                'title' => 'Research in Hospitality',
                'units' => 3,
                'year_level' => 3,
                'semester' => 1,
                'prerequisites' => ['GE 1'],
                'description' => 'BSHM - Third Year - First Semester',
            ],

            // ═══════════════════════════════════════
            // THIRD YEAR — SECOND SEMESTER
            // ═══════════════════════════════════════
            // NOTE: BME 2 (BSHM) title differs from BSTM's BME 2
            [
                'code' => 'BME 2',
                'title' => 'Strategic Management in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['BME 1'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            // NOTE: THC 8 (BSHM) prereq is HMPE 2; BSTM THC 8 prereqs are THC 1 + THC 2
            [
                'code' => 'THC 8',
                'title' => 'Legal Aspects in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['HMPE 2'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            // NOTE: THC 9 (BSHM) title differs from BSTM's THC 9
            [
                'code' => 'THC 9',
                'title' => 'Multicultural Diversity in the Workplace for the Tourism Professional',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['BME 1'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            [
                'code' => 'THC 10',
                'title' => 'Entrepreneurship in Tourism and Hospitality',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['BME 1'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            // NOTE: GE ELECT 5 (BSHM) title differs from BSTM
            [
                'code' => 'GE ELECT 5',
                'title' => 'The Entrepreneurial Mind',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['BME 1'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            [
                'code' => 'HPC 9',
                'title' => 'Ergonomics and Facilities Planning for the Hospitality Industry',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['BME 1'],
                'description' => 'BSHM - Third Year - Second Semester',
            ],
            // NOTE: HMPE 4 (BSHM) title differs slightly from BSTM
            [
                'code' => 'HMPE 4',
                'title' => 'Housekeeping Operations',
                'units' => 3,
                'year_level' => 3,
                'semester' => 2,
                'prerequisites' => ['HMPE 1'],
                'description' => 'BSHM - Third Year - Second Semester',
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
                'prerequisites' => ['HPC 1'],
                'description' => 'BSHM - Fourth Year - First Semester',
            ],
            [
                'code' => 'RIZAL',
                'title' => 'Life and Works of Rizal',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - Fourth Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 2',
                'title' => 'Environmental Science',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['GE 5'],
                'description' => 'BSHM - Fourth Year - First Semester',
            ],
            [
                'code' => 'GE ELECT 3',
                'title' => 'PEACE Education',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => ['GE 4'],
                'description' => 'BSHM - Fourth Year - First Semester',
            ],
            [
                'code' => 'GE 9',
                'title' => 'Art Appreciation',
                'units' => 3,
                'year_level' => 4,
                'semester' => 1,
                'prerequisites' => [],
                'description' => 'BSHM - Fourth Year - First Semester',
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
                // Special: "Finished all Academic Requirements" — helper will warn and skip
                'prerequisites' => ['Finished all Academic Requirements'],
                'description' => 'BSHM - Fourth Year - Second Semester',
            ],
        ];

        $this->seedProgramCurriculum('BSHM', $rows);
    }
}
