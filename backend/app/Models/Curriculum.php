<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Curriculum extends Model
{
    protected $table = 'curriculum';

    protected $fillable = ['program_id', 'subject_id', 'year_level', 'semester', 'prerequisite', 'unresolved_prerequisites', 'prerequisite_logic'];

    /**
     * Cast unresolved_prerequisites from/to a PHP array automatically.
     * Null means no unresolved prerequisites exist for this curriculum row.
     */
    protected $casts = [
        'unresolved_prerequisites' => 'array',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * @deprecated Use prerequisites() instead to support multiple subjects.
     */
    public function prerequisite(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'prerequisite');
    }

    public function prerequisites()
    {
        return $this->belongsToMany(
            Subject::class,
            'curriculum_prerequisites',
            'curriculum_id',
            'prerequisite_subject_id'
        )->withTimestamps();
    }
}
