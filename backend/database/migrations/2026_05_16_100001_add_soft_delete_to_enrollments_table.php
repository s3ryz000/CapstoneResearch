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

        // Drop the unique index so soft-deleted rows don't block re-enrollment.
        // MySQL requires dropping FKs first; SQLite has no named FK constraints.
        $driver = DB::getDriverName();
        $indexName = 'enrollments_student_id_subject_id_academic_year_semester_unique';

        $indexExists = collect(Schema::getIndexes('enrollments'))
            ->contains(fn($i) => $i['name'] === $indexName);

        if ($indexExists) {
            if ($driver === 'mysql') {
                $fks = DB::select("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME='enrollments' AND TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'");
                foreach ($fks as $fk) {
                    DB::statement("ALTER TABLE enrollments DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
                }
                DB::statement("ALTER TABLE enrollments DROP INDEX `{$indexName}`");
                DB::statement('ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_id_foreign FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE');
                DB::statement('ALTER TABLE enrollments ADD CONSTRAINT enrollments_subject_id_foreign FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE');
            } else {
                // SQLite: recreate the table without the unique index (handled via schema rebuild)
                Schema::table('enrollments', function (Blueprint $table) use ($indexName) {
                    $table->dropUnique($indexName);
                });
            }
        }
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->unique(['student_id', 'subject_id', 'academic_year', 'semester']);
            $table->dropSoftDeletes();
            $table->dropColumn(['deleted_by', 'delete_reason']);
        });
    }
};
