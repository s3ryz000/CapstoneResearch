<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollment_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('enrollment_id');          // the enrollment row affected
            $table->unsignedBigInteger('subject_id');
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->string('old_status', 30)->nullable();
            $table->string('new_status', 30)->nullable();
            $table->unsignedBigInteger('changed_by')->nullable(); // user_id of staff/admin
            $table->string('action', 50);                         // 'archived', 'restored', 'created'
            $table->string('reason', 255)->nullable();
            $table->boolean('had_grade')->default(false);         // whether a grade existed at time of action
            $table->timestamps();

            $table->foreign('student_id')->references('student_id')->on('students')->onDelete('cascade');
            $table->foreign('subject_id')->references('id')->on('subjects')->onDelete('cascade');
            $table->index(['student_id', 'enrollment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollment_audit_logs');
    }
};
