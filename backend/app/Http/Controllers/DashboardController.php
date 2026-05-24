<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Models\RecordRequest;
use App\Models\Student;
use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Role-based dashboard data: KPIs and recent activity.
 */
class DashboardController extends Controller
{
    use AuthorizesRole;

    /**
     * Dashboard data by role: admin (full), staff (operational), student (own requests).
     */
    public function index(Request $request): JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }

        $user = $request->user();
        $role = $this->userRole($user);

        if ($role === 'admin' || $role === 'staff') {
            return $this->staffOrAdminDashboard($request);
        }

        if ($role === 'student') {
            return $this->studentDashboard($request);
        }

        return response()->json(['message' => 'Unknown role.', 'role' => $role], 403);
    }

    private function staffOrAdminDashboard(Request $request): JsonResponse
    {
        $pendingCount = RecordRequest::where('status', RecordRequest::STATUS_PENDING)->count();
        $pendingProfileUpdates = \App\Models\PendingStudentUpdate::where('status', 'pending')->count();
        $processedToday = Student::whereDate('created_at', today())->count();
        $studentsCount = \App\Models\Student::count();
        $releasedToday = RecordRequest::where('status', RecordRequest::STATUS_RELEASED)
            ->whereDate('released_at', today())
            ->count();

            $recentActivity = SystemLog::with('user:id,name')->latest()
            ->take(5)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'type' => 'default',
                    'desc' => $log->action,
                    'time' => $log->created_at,
                    'user' => $log->user,
                ];
            });

        return response()->json([
            'kpis' => [
                'pending_requests' => $pendingCount,
                'pending_profile_updates' => $pendingProfileUpdates,
                'processed_today' => $processedToday,
                'students_count' => $studentsCount,
                'documents_released_today' => $releasedToday,
            ],
            'recent_activity' => $recentActivity,
        ]);
    }

    private function studentDashboard(Request $request): JsonResponse
    {
        $student = $request->user()->student;
        if (! $student) {
            return response()->json([
                'kpis' => ['pending_requests' => 0, 'approved' => 0, 'rejected' => 0, 'released' => 0],
                'my_requests' => [],
            ]);
        }

        $myRequests = RecordRequest::where('student_id', $student->student_id)
            ->orderByDesc('requested_at')
            ->limit(10)
            ->get(['id', 'record_type', 'purpose', 'status', 'requested_at', 'processed_at', 'released_at']);

        $pending = RecordRequest::where('student_id', $student->student_id)->where('status', RecordRequest::STATUS_PENDING)->count();
        $approved = RecordRequest::where('student_id', $student->student_id)->where('status', RecordRequest::STATUS_APPROVED)->count();
        $rejected = RecordRequest::where('student_id', $student->student_id)->where('status', RecordRequest::STATUS_REJECTED)->count();
        $released = RecordRequest::where('student_id', $student->student_id)->where('status', RecordRequest::STATUS_RELEASED)->count();

        return response()->json([
            'kpis' => [
                'pending_requests' => $pending,
                'approved' => $approved,
                'rejected' => $rejected,
                'released' => $released,
            ],
            'my_requests' => $myRequests,
        ]);
    }
}
