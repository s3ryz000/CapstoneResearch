<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Rules aligned with students table schema. Unique rules ignore current student.
     */
    public function rules(): array
    {
        $studentId = $this->route('id');
        $student = \App\Models\Student::find($studentId);
        $userId = $student?->user_id;

        return [
            'student_number' => [
                'required',
                'string',
                'max:20',
                Rule::unique('students', 'student_number')->ignore($studentId, 'student_id'),
                Rule::unique('users', 'username')->ignore($userId),
            ],
            'first_name' => ['required', 'string', 'max:50'],
            'middle_name' => ['nullable', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:50'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'email' => [
                'required',
                'string',
                'email',
                'max:100',
                Rule::unique('students', 'email')->ignore($studentId, 'student_id'),
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'contact_number' => ['nullable', 'string', 'max:15'],
            'address' => ['nullable', 'string', 'max:150'],
            'place_of_birth' => ['nullable', 'string', 'max:120'],
            'sex' => ['nullable', 'string', 'in:M,F'],
            'guardian_name' => ['nullable', 'string', 'max:120'],
            'citizenship' => ['nullable', 'string', 'max:60'],
            'elementary_school' => ['nullable', 'string', 'max:150'],
            'elementary_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'high_school' => ['nullable', 'string', 'max:150'],
            'high_school_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'previous_school' => ['nullable', 'string', 'max:150'],
            'previous_course' => ['nullable', 'string', 'max:150'],
            'enrollment_date' => ['required', 'date', 'before_or_equal:today'],
            'graduation_date' => ['nullable', 'date', 'after_or_equal:enrollment_date'],

        ];
    }

    public function messages(): array
    {
        return [
            'student_number.unique' => 'This student number is already registered.',
            'email.unique' => 'This email is already registered.',
        ];
    }
}
