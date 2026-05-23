<?php

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

class ProgramSeeder extends Seeder
{
    public function run(): void
    {
        $programs = [
            [
                'code' => 'BSTM',
                'name' => 'Bachelor of Science in Tourism Management',
                'description' => 'Based on CMO No. 62, Series of 2017 and CMO No. 20, Series of 2013',
            ],
            [
                'code' => 'BSHM',
                'name' => 'Bachelor of Science in Hospitality Management',
                'description' => 'Based on CMO No. 62, Series of 2017 and CMO No. 20, Series of 2013',
            ],
            [
                'code' => 'BSE',
                'name' => 'Bachelor of Science in Entrepreneurship',
                'description' => 'Based on CMO No. 18, Series of 2017 and CMO No. 20, Series of 2013',
            ],
        ];

        foreach ($programs as $data) {
            Program::updateOrCreate(
                ['code' => $data['code']],
                [
                    'name' => $data['name'],
                    'description' => $data['description'],
                ]
            );
        }

        $this->command->info('[OK] Programs seeded (BSTM, BSHM, BSE).');
    }
}
