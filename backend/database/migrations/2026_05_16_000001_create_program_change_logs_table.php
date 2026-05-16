<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_change_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('old_program_id')->nullable();
            $table->unsignedBigInteger('new_program_id');
            $table->string('reason', 100);
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('changed_by');
            $table->integer('affected_enrollments_archived')->default(0);
            $table->timestamps();

            $table->foreign('student_id')->references('student_id')->on('students')->onDelete('cascade');
            $table->foreign('old_program_id')->references('id')->on('programs')->onDelete('set null');
            $table->foreign('new_program_id')->references('id')->on('programs')->onDelete('cascade');
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_change_logs');
    }
};
