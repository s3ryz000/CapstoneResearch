<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Order matters:
     *   1. RoleSeeder        — roles and permissions
     *   2. AccountSeeder     — default admin/staff accounts
     *   3. ProgramSeeder     — programs (BSTM, BSHM, BSE) via updateOrCreate
     *   4. Curriculum seeders — subjects + curriculum rows + prerequisites per program
     *   5. SystemSettingsSeeder
     *
     * ProgramAndCourseSeeder is intentionally NOT called here.
     * It is kept as a historical reference only and must not be run again
     * after the curriculum seeders have been executed.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            AccountSeeder::class,
            ProgramSeeder::class,
            BstmCurriculumSeeder::class,
            BshmCurriculumSeeder::class,
            BseCurriculumSeeder::class,
            SystemSettingsSeeder::class,
        ]);
    }
}

