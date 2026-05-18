<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $year = (int) date('Y');
        $defaults = [
            'academic_year'                => $year . '-' . ($year + 1),
            'semester'                     => '2nd Semester',
            'institution_name'             => 'Trece Martires City College',
            'institution_short_name'       => 'TMCC',
            'institution_address'          => 'Trece Martires City, Cavite',
            'email_notifications_enabled'  => '0',
        ];

        foreach ($defaults as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
