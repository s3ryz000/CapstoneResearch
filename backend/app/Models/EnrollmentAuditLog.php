<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnrollmentAuditLog extends Model
{
    protected $fillable = [
        'student_id',
        'enrollment_id',
        'subject_id',
        'academic_year',
        'semester',
        'old_status',
        'new_status',
        'changed_by',
        'action',
        'reason',
        'had_grade',
        'old_value',
        'new_value',
        'supporting_document_reference',
        'user_role',
    ];

    protected $casts = [
        'had_grade' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
