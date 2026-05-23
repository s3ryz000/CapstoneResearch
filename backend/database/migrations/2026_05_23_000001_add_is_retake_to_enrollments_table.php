<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add is_retake flag to enrollments table.
 *
 * is_retake = true when the enrollment is a re-attempt of a previously
 * Failed, Withdrawn, or FDA subject in a later term.
 * Null/false = regular first-time enrollment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->boolean('is_retake')->default(false)->after('year_level');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('is_retake');
        });
    }
};
