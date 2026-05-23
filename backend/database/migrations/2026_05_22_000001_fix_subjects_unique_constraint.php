<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drop the global unique constraint on subjects.code
 * and replace it with a composite unique on (code, title).
 *
 * Rationale:
 * The same subject code can appear across different program curricula with
 * different titles. For example:
 *   GE 1 (BSTM/BSHM) = "Purposive Communication"
 *   GE 1 (BSE)       = "Understanding the Self"
 *   THC 3 (BSTM)     = "Tourism and Hospitality Service Quality Management"
 *   THC 3 (BSHM)     = "Quality Service Management in Tourism and Hospitality"
 *
 * Code alone is therefore not a reliable global unique key.
 * The composite (code, title) correctly allows different titled subjects
 * to share a code, while still preventing true exact duplicates.
 *
 * SQLite compatibility:
 * SQLite does not support dropping columns or indexes directly via ALTER TABLE.
 * Laravel's dropUnique() works on SQLite only if doctrine/dbal is not needed.
 * Since migrate:fresh rebuilds from scratch, this migration modifies the
 * original create_subjects_table via Schema::table() and is safe.
 *
 * If running migrate:fresh, the original create_subjects_table migration
 * runs first (code unique), then THIS migration drops it and replaces it.
 */
return new class extends Migration
{
    public function up(): void
    {
        // SQLite does not support dropping indexes via ALTER TABLE in the standard way.
        // Laravel's Schema::table dropUnique works through grammar — safe for SQLite in Laravel 10+.
        Schema::table('subjects', function (Blueprint $table) {
            // Drop the global unique index on code
            $table->dropUnique(['code']); // drops subjects_code_unique

            // Add composite unique on (code, title)
            // This allows same code with different title (different programs),
            // but prevents true exact duplicate subject rows.
            $table->unique(['code', 'title'], 'subjects_code_title_unique');
        });
    }

    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropUnique('subjects_code_title_unique');
            $table->unique('code'); // restore original
        });
    }
};
