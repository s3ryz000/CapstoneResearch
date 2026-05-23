<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Enrollment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'student_id',
        'subject_id',
        'academic_year',
        'semester',
        'year_level',
        'status',
        'is_retake',
        'deleted_by',
        'delete_reason',
    ];

    protected $casts = [
        'is_retake' => 'boolean',
    ];

    protected $dates = ['deleted_at'];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * The grade record linked to this enrollment (same student, subject, term).
     */
    public function grade(): HasOne
    {
        return $this->hasOne(Grade::class, 'enrollment_id', 'id');
    }
}
