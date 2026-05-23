<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRecordRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'record_type' => ['required', 'string', 'in:transcript,certificate_of_grades,copy_of_grades,deans_list_certificate,presidents_list_certificate,latin_honor_certificate'],
            'academic_year' => ['nullable', 'string', 'max:20'],
            'semester' => ['nullable', 'string', 'max:20'],
            'award_name' => ['nullable', 'string', 'max:100'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'copies' => ['nullable', 'integer', 'min:1', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'record_type.in' => 'Invalid document type requested.',
        ];
    }
}
