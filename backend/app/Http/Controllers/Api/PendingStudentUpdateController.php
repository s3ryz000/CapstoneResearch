<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Models\PendingStudentUpdate;
use App\Models\SystemLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PendingStudentUpdateController extends Controller
{
    use AuthorizesRole;

    /**
     * List all pending student updates.
     */
    public function index(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $updates = PendingStudentUpdate::with(['student:student_id,student_number,first_name,last_name,program_id', 'student.program', 'submitter:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($updates);
    }

    /**
     * View a specific pending update.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $update = PendingStudentUpdate::with(['student', 'submitter', 'reviewer'])->find($id);

        if (!$update) {
            return response()->json(['message' => 'Pending update not found.'], 404);
        }

        return response()->json($update);
    }

    /**
     * Approve a pending update.
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $update = PendingStudentUpdate::with('student')->find($id);

        if (!$update) {
            return response()->json(['message' => 'Pending update not found.'], 404);
        }

        if ($update->status !== 'pending') {
            return response()->json(['message' => 'This update has already been processed.'], 422);
        }

        $user = $request->user();

        DB::transaction(function () use ($update, $user) {
            $student = $update->student;
            
            // Apply new values
            $student->update($update->new_values);

            // Mark update as approved
            $update->update([
                'status' => 'approved',
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            $studentName = trim($student->first_name . ' ' . $student->last_name);
            $studentNumber = $student->student_number ?? "ID#{$student->student_id}";
            $changedStr = implode(', ', $update->changed_fields ?? []);
            
            SystemLog::create([
                'action' => "Approved profile update for {$studentNumber} ({$studentName}): fields: {$changedStr}",
                'user_id' => $user->id,
                'role' => $user->roles->first()?->name ?? $user->role ?? 'staff',
            ]);
        });

        return response()->json([
            'message' => 'Student profile update approved successfully.',
            'update' => $update->fresh(['student', 'reviewer'])
        ]);
    }

    /**
     * Reject a pending update.
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $update = PendingStudentUpdate::with('student')->find($id);

        if (!$update) {
            return response()->json(['message' => 'Pending update not found.'], 404);
        }

        if ($update->status !== 'pending') {
            return response()->json(['message' => 'This update has already been processed.'], 422);
        }

        $user = $request->user();
        $validated = $request->validate([
            'rejection_reason' => 'nullable|string|max:1000'
        ]);

        DB::transaction(function () use ($update, $user, $validated) {
            // Mark update as rejected
            $update->update([
                'status' => 'rejected',
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
                'rejection_reason' => $validated['rejection_reason'] ?? null,
            ]);

            $student = $update->student;
            $studentName = trim($student->first_name . ' ' . $student->last_name);
            $studentNumber = $student->student_number ?? "ID#{$student->student_id}";
            $changedStr = implode(', ', $update->changed_fields ?? []);
            
            SystemLog::create([
                'action' => "Rejected profile update for {$studentNumber} ({$studentName}): fields: {$changedStr}",
                'user_id' => $user->id,
                'role' => $user->roles->first()?->name ?? $user->role ?? 'staff',
            ]);
        });

        return response()->json([
            'message' => 'Student profile update rejected.',
            'update' => $update->fresh(['student', 'reviewer'])
        ]);
    }

    /**
     * Download or view the supporting document.
     */
    public function downloadDocument(Request $request, int $id)
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['staff', 'admin'])) {
            return $err;
        }

        $update = PendingStudentUpdate::find($id);

        if (!$update || !$update->supporting_document_path) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $path = $update->supporting_document_path;

        if (!\Illuminate\Support\Facades\Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'Document file does not exist on server.'], 404);
        }

        return \Illuminate\Support\Facades\Storage::disk('local')->download(
            $path,
            $update->supporting_document_original_name
        );
    }
}
