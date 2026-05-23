<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── grades table: add status, enrollment_id, supporting doc, INC conversion tracking ──
        Schema::table('grades', function (Blueprint $table) {
            if (!Schema::hasColumn('grades', 'status')) {
                $table->string('status', 30)->nullable()->after('remarks');
            }
            if (!Schema::hasColumn('grades', 'enrollment_id')) {
                $table->unsignedBigInteger('enrollment_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('grades', 'supporting_document_reference')) {
                $table->string('supporting_document_reference', 255)->nullable()->after('status');
            }
            if (!Schema::hasColumn('grades', 'converted_from_status')) {
                $table->string('converted_from_status', 30)->nullable()->after('supporting_document_reference');
            }
            if (!Schema::hasColumn('grades', 'converted_at')) {
                $table->timestamp('converted_at')->nullable()->after('converted_from_status');
            }
        });

        // ── enrollments table: add year_level ──
        Schema::table('enrollments', function (Blueprint $table) {
            if (!Schema::hasColumn('enrollments', 'year_level')) {
                $table->unsignedTinyInteger('year_level')->nullable()->after('semester');
            }
        });

        // ── enrollment_audit_logs: add old_value, new_value, supporting doc, user_role ──
        Schema::table('enrollment_audit_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('enrollment_audit_logs', 'old_value')) {
                $table->text('old_value')->nullable()->after('had_grade');
            }
            if (!Schema::hasColumn('enrollment_audit_logs', 'new_value')) {
                $table->text('new_value')->nullable()->after('old_value');
            }
            if (!Schema::hasColumn('enrollment_audit_logs', 'supporting_document_reference')) {
                $table->string('supporting_document_reference', 255)->nullable()->after('new_value');
            }
            if (!Schema::hasColumn('enrollment_audit_logs', 'user_role')) {
                $table->string('user_role', 30)->nullable()->after('supporting_document_reference');
            }
        });

        // ── Backfill: copy year_level from program_mappings to enrollments ──
        DB::statement("
            UPDATE enrollments
            SET year_level = (
                SELECT pm.year_level
                FROM program_mappings pm
                WHERE pm.student_id = enrollments.student_id
                  AND pm.academic_year = enrollments.academic_year
                  AND pm.semester = enrollments.semester
                LIMIT 1
            )
            WHERE year_level IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $cols = ['status', 'enrollment_id', 'supporting_document_reference', 'converted_from_status', 'converted_at'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('grades', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('enrollments', function (Blueprint $table) {
            if (Schema::hasColumn('enrollments', 'year_level')) {
                $table->dropColumn('year_level');
            }
        });

        Schema::table('enrollment_audit_logs', function (Blueprint $table) {
            $cols = ['old_value', 'new_value', 'supporting_document_reference', 'user_role'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('enrollment_audit_logs', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
