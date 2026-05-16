<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Rules aligned with students table schema and thesis requirements.
     *
     */
    public function rules(): array
    {
        return [
            'student_number' => ['required', 'string', 'max:20', 'unique:students,student_number', 'unique:users,username'],
            'first_name' => ['required', 'string', 'max:50'],
            'middle_name' => ['nullable', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:50'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'email' => ['required', 'string', 'email', 'max:100', 'unique:students,email', 'unique:users,email'],
            'contact_number' => ['nullable', 'string', 'max:15'],
            'address' => ['nullable', 'string', 'max:150'],
            'place_of_birth' => ['nullable', 'string', 'max:120'],
            'sex' => ['nullable', 'string', 'max:10', 'in:Male,Female,male,female'],
            'guardian_name' => ['nullable', 'string', 'max:120'],
            'citizenship' => ['nullable', 'string', 'max:60'],
            'elementary_school' => ['nullable', 'string', 'max:150'],
            'elementary_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'high_school' => ['nullable', 'string', 'max:150'],
            'high_school_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'previous_school' => ['nullable', 'string', 'max:150'],
            'previous_course' => ['nullable', 'string', 'max:150'],
            'enrollment_date' => ['required', 'date'],
            'graduation_date' => ['nullable', 'date', 'after_or_equal:enrollment_date'],
            'GPA' => ['nullable', 'numeric', 'min:0', 'max:5.00'],
            'program_id' => ['required', 'exists:programs,id'],
            'subject_ids' => ['nullable', 'array'],
            'subject_ids.*' => ['exists:subjects,id'],


            'record_type' => 'required_if:is_archived,true|string',
            'cabinet_no' => 'required_if:is_archived,true|string',
            'shelf_no' => 'required_if:is_archived,true|string',
            'folder_code' => 'required_if:is_archived,true|string',
            'document_status' => 'required_if:is_archived,true|string',
            'is_archived' => 'required|boolean',
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
