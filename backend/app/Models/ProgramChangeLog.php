<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramChangeLog extends Model
{
    protected $table = 'program_change_logs';

    protected $fillable = [
        'student_id',
        'old_program_id',
        'new_program_id',
        'reason',
        'remarks',
        'changed_by',
        'affected_enrollments_archived',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function oldProgram(): BelongsTo
    {
        return $this->belongsTo(Program::class, 'old_program_id');
    }

    public function newProgram(): BelongsTo
    {
        return $this->belongsTo(Program::class, 'new_program_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
