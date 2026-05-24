<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingStudentUpdate extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'submitted_by',
        'reviewed_by',
        'status',
        'old_values',
        'new_values',
        'changed_fields',
        'supporting_document_path',
        'supporting_document_original_name',
        'supporting_document_mime',
        'supporting_document_size',
        'rejection_reason',
        'reviewed_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'changed_fields' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by', 'id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'id');
    }
}
