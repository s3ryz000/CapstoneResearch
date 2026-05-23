<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Http\Requests\StoreRecordRequestRequest;
use App\Models\RecordRequest;
use App\Models\Student;
use App\Models\SystemLog;
use App\Services\OfficialTranscriptExportService;
use App\Services\AcademicStandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Student: submit record request and view own requests.
 */
class RecordRequestController extends Controller
{
    use AuthorizesRole;

    public function __construct(
        private AcademicStandingService $academicStandingService
    ) {}

    /**
     * List authenticated student's record requests.
     */
    public function index(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.', 'data' => []], 200);
        }

        $query = RecordRequest::where('student_id', $student->student_id)->orderByDesc('requested_at');

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $items = $query->paginate($perPage);

        return response()->json($items);
    }

    /**
     * Submit a new record request (student only).
     */
    public function store(StoreRecordRequestRequest $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found. Cannot submit request.'], 403);
        }

        $validated = $request->validated();
        $validated['student_id'] = $student->student_id;
        $validated['status'] = RecordRequest::STATUS_PENDING;
        $validated['requested_at'] = now();
        $validated['copies'] = $validated['copies'] ?? 1;

        $recordType = $validated['record_type'];
        $academicYear = $validated['academic_year'] ?? null;
        $semester = $validated['semester'] ?? null;

        // Prevent duplicate pending requests
        $existing = RecordRequest::where('student_id', $student->student_id)
            ->where('record_type', $recordType)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', RecordRequest::STATUS_PENDING)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You already have a pending request for this document.'], 422);
        }

        // Check eligibility for awards
        if (in_array($recordType, ['deans_list_certificate', 'presidents_list_certificate', 'latin_honor_certificate'])) {
            $summary = $this->academicStandingService->getAcademicSummary($student);
            $isEligible = false;

            if ($recordType === 'deans_list_certificate') {
                foreach ($summary['terms'] as $term) {
                    if ($term['academic_year'] === $academicYear && $term['semester'] === $semester) {
                        $isEligible = $term['deans_list']['eligible'];
                        break;
                    }
                }
            } elseif ($recordType === 'presidents_list_certificate') {
                foreach ($summary['years'] as $year) {
                    if ($year['academic_year'] === $academicYear) {
                        $isEligible = $year['presidents_list']['eligible'];
                        break;
                    }
                }
            } elseif ($recordType === 'latin_honor_certificate') {
                $isEligible = $summary['latin_honors']['eligible'];
                if ($isEligible) {
                    $validated['award_name'] = $summary['latin_honors']['honor'];
                }
            }

            if (!$isEligible) {
                return response()->json(['message' => 'You are not eligible to request this award certificate.'], 403);
            }
        }

        $recordRequest = RecordRequest::create($validated);
        SystemLog::create([
            'action' => 'Document request submitted',
            'user_id' => $request->user()->id,
            'role' => $request->user()->roles->first()?->name ?? $request->user()->role ?? null,
        ]);
        return response()->json([
            'message' => 'Record request submitted successfully.',
            'record_request' => $recordRequest,
        ], 201);
    }

    /**
     * Show a single record request (own only).
     */
    public function show(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 403);
        }

        $recordRequest = RecordRequest::where('student_id', $student->student_id)->find($id);
        if (! $recordRequest) {
            return response()->json(['message' => 'Record request not found.'], 404);
        }

        return response()->json(['record_request' => $recordRequest]);
    }

    /**
     * Download the official transcript PDF for an approved/released request (student only).
     */
    public function downloadTranscript(Request $request, int $id): StreamedResponse|JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['student'])) {
            return $err;
        }

        $student = $request->user()->student;
        if (! $student) {
            return response()->json(['message' => 'Student record not found.'], 403);
        }

        $recordRequest = RecordRequest::where('student_id', $student->student_id)->find($id);
        if (! $recordRequest) {
            return response()->json(['message' => 'Record request not found.'], 404);
        }

        if (! in_array($recordRequest->status, [RecordRequest::STATUS_APPROVED, RecordRequest::STATUS_RELEASED], true)) {
            return response()->json(['message' => 'Transcript is only available once your request has been approved.'], 422);
        }

        return app(OfficialTranscriptExportService::class)->streamForStudent($student);
    }
}
