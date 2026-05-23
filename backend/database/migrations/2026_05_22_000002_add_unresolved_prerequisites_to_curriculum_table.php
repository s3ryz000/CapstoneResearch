<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add unresolved_prerequisites column to the curriculum table.
 *
 * When a seeder defines a prerequisite code that does not exist in
 * that program's curriculum (e.g. 'TPC 3' for BSHM BME 1), rather than
 * silently dropping the prerequisite or crashing, we store the unresolved
 * codes here as a JSON array.
 *
 * At runtime, if this column is non-null/non-empty, the subject is blocked
 * for enrollment with a clear message:
 * "Unresolved prerequisite: TPC 3. Registrar must verify curriculum mapping."
 *
 * This prevents subjects with broken prerequisite chains from appearing
 * as freely eligible when they should not be.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('curriculum', function (Blueprint $table) {
            // Stores JSON array of prerequisite codes that could not be
            // resolved during seeding. Null = no unresolved prerequisites.
            // Example: ["TPC 3"] for BSHM BME 1
            $table->json('unresolved_prerequisites')->nullable()->after('prerequisite');
        });
    }

    public function down(): void
    {
        Schema::table('curriculum', function (Blueprint $table) {
            $table->dropColumn('unresolved_prerequisites');
        });
    }
};
