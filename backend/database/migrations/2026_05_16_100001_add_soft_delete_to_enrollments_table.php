<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            // Guard against partial application from a prior failed run
            if (!Schema::hasColumn('enrollments', 'deleted_at')) {
                $table->softDeletes();
            }
            if (!Schema::hasColumn('enrollments', 'deleted_by')) {
                $table->unsignedBigInteger('deleted_by')->nullable();
            }
            if (!Schema::hasColumn('enrollments', 'delete_reason')) {
                $table->string('delete_reason', 255)->nullable();
            }
        });

        // Check if the unique index still exists before trying to drop it.
        // MySQL uses this unique index to back BOTH the student_id FK (to students) and subject_id FK (to subjects).
        // We must drop BOTH FKs first, drop the unique, then re-add both FKs.
        $indexes = DB::select("SHOW INDEX FROM enrollments WHERE Key_name = 'enrollments_student_id_subject_id_academic_year_semester_unique'");
        if (!empty($indexes)) {
            // Drop both FKs that depend on this index
            $fks = DB::select("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME='enrollments' AND TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'");
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE enrollments DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }
            DB::statement('ALTER TABLE enrollments DROP INDEX enrollments_student_id_subject_id_academic_year_semester_unique');
            // Re-add both FKs
            DB::statement('ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_id_foreign FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE');
            DB::statement('ALTER TABLE enrollments ADD CONSTRAINT enrollments_subject_id_foreign FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE');
        }
    }

    public function down(): void
    {
        // Reverse: drop FK, re-add unique, re-add FK
        DB::statement('ALTER TABLE enrollments DROP FOREIGN KEY enrollments_subject_id_foreign');
        DB::statement('ALTER TABLE enrollments ADD UNIQUE KEY enrollments_student_id_subject_id_academic_year_semester_unique (student_id, subject_id, academic_year, semester)');
        DB::statement('ALTER TABLE enrollments ADD CONSTRAINT enrollments_subject_id_foreign FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE');

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['deleted_by', 'delete_reason']);
        });
    }
};
