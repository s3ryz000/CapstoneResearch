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
            'record_type' => ['required', 'string', 'in:official_transcript'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'copies' => ['nullable', 'integer', 'min:1', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'record_type.in' => 'Only Official Transcript of Record requests are accepted.',
        ];
    }
}
