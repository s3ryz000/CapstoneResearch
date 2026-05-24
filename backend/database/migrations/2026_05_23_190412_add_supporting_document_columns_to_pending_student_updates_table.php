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
        Schema::table('pending_student_updates', function (Blueprint $table) {
            $table->string('supporting_document_path')->nullable()->after('changed_fields');
            $table->string('supporting_document_original_name')->nullable()->after('supporting_document_path');
            $table->string('supporting_document_mime')->nullable()->after('supporting_document_original_name');
            $table->unsignedBigInteger('supporting_document_size')->nullable()->after('supporting_document_mime');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pending_student_updates', function (Blueprint $table) {
            $table->dropColumn([
                'supporting_document_path',
                'supporting_document_original_name',
                'supporting_document_mime',
                'supporting_document_size',
            ]);
        });
    }
};
