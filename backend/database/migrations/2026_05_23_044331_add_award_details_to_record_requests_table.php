<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('record_requests', function (Blueprint $table) {
            $table->string('academic_year', 20)->nullable()->after('record_type');
            $table->string('semester', 20)->nullable()->after('academic_year');
            $table->string('award_name', 100)->nullable()->after('semester');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('record_requests', function (Blueprint $table) {
            $table->dropColumn(['academic_year', 'semester', 'award_name']);
        });
    }
};
