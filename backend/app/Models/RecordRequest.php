<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Record request lifecycle: pending → approved|rejected; approved → released.
 */
class RecordRequest extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_RELEASED = 'released';

    protected $fillable = [
        'student_id',
        'record_type',
        'academic_year',
        'semester',
        'award_name',
        'purpose',
        'copies',
        'status',
        'requested_at',
        'processed_by',
        'processed_at',
        'appointment_at',
        'released_at',
        'rejection_reason',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
        'appointment_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'processed_by', 'staff_id');
    }
}
