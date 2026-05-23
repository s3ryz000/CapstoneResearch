<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        // create roles
        echo "Creating roles...\n";
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);
        Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'api']);
        Role::firstOrCreate(['name' => 'student', 'guard_name' => 'api']);
        echo "Roles created successfully\n";

        // create permissions
        echo "Creating permissions...\n";
        Permission::firstOrCreate(['name' => 'create-user']);
        Permission::firstOrCreate(['name' => 'edit-user']);
        Permission::firstOrCreate(['name' => 'delete-user']);
        echo "Permissions created successfully\n";
    }
}
