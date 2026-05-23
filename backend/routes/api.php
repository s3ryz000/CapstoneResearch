<?php

use App\Http\Controllers\Admin\SystemLogController;
use App\Http\Controllers\Admin\SystemSettingsController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\auth\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\Student\RecordRequestController;
use App\Http\Controllers\Student\StudentProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


// ---- Authentication (rate-limited to mitigate brute force) ----
Route::prefix('auth')->middleware('throttle:6,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

// ---- Current user (all authenticated roles) ----
Route::get('/user', function (Request $request) {
    $user = $request->user();
    if (! $user) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }
    return response()->json($user->load('roles'));
})->middleware('auth:sanctum');

// ---- Dashboard (role-based data; all authenticated) ----
Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware('auth:sanctum');

// ---- System settings: current term (read-only; staff, admin, student) ----
Route::get('/settings/current', [SystemSettingsController::class, 'current'])
    ->middleware(['auth:sanctum', 'role:staff,admin,student']);

// ---- Staff & Admin: Students ----
Route::middleware(['auth:sanctum', 'role:staff,admin'])->prefix('staff')->group(function () {
    Route::get('/subjects', [StudentController::class, 'subjects']);
    Route::get('/programs', [StudentController::class, 'programs']);
    Route::get('/programs/{id}/curriculum', [StudentController::class, 'programSubjects']);
    

    // Academic Progression endpoints (defined first to prevent wildcard parameter conflict)
    Route::get('/students/{id}/academic-progress', [StudentController::class, 'academicProgress']);
    Route::get('/students/{id}/academic-summary', [StudentController::class, 'academicSummary']);
    Route::post('/students/{id}/enrollments/add-next-term', [StudentController::class, 'addNextTerm']);
    Route::put('/students/{id}/grades/bulk-update', [StudentController::class, 'bulkUpdateGrades']);

    Route::get('/students', [StudentController::class, 'index']);
    Route::post('/students', [StudentController::class, 'store']);
    Route::post('/students/{id}/archive', [StudentController::class, 'archiveStudent']);
    Route::patch('/students/{id}/program', [StudentController::class, 'updateProgram']);
    Route::get('/students/{id}/transcript', [StudentController::class, 'downloadTranscript']);
    Route::get('/students/{id}', [StudentController::class, 'show']);
    Route::put('/students/{id}', [StudentController::class, 'update']);
    Route::post('/students/{id}/enrollments', [StudentController::class, 'storeEnrollment']);
    Route::put('/students/{id}/enrollments/{enrollmentId}', [StudentController::class, 'updateEnrollment']);
    Route::delete('/students/{id}/enrollments/{enrollmentId}', [StudentController::class, 'destroyEnrollment']);
    Route::post('/students/{id}/grades', [StudentController::class, 'storeGrade']);
    Route::put('/students/{id}/grades/{gradeId}', [StudentController::class, 'updateGrade']);
    Route::delete('/students/{id}/grades/{gradeId}', [StudentController::class, 'destroyGrade']);
});

// ---- Staff & Admin: Record requests (pending, approve, reject, approved list, release) ----
Route::middleware(['auth:sanctum', 'role:staff,admin'])->prefix('staff')->group(function () {
    Route::get('/pending-requests', [RequestController::class, 'indexPending']);
    Route::patch('/requests/{id}/approve', [RequestController::class, 'approve']);
    Route::patch('/requests/{id}/reject', [RequestController::class, 'reject']);
    Route::get('/appointment-slots', [RequestController::class, 'appointmentSlots']);
    Route::get('/approved-release', [RequestController::class, 'indexApproved']);
    Route::get('/rejected-requests', [RequestController::class, 'indexRejected']);
    Route::put('/requests/{id}/release', [RequestController::class, 'release']);
    Route::post('/transactions', [RequestController::class, 'storeTransaction']);
    Route::get('/requests/{id}/transcript-template', [RequestController::class, 'downloadTranscriptTemplate']);
    Route::get('/requests/{id}/approval-slip', [RequestController::class, 'downloadApprovalSlipStaff']);
});

// ---- Staff & Admin: Reports ----
Route::middleware(['auth:sanctum', 'role:staff,admin'])->prefix('staff')->group(function () {
    Route::get('/reports/summary', [ReportController::class, 'summary']);
    Route::get('/reports/transaction-history', [ReportController::class, 'transactionHistory']);
});

// ---- Admin only: Users CRUD ----
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::get('/logs', [SystemLogController::class, 'index']);
    Route::get('/logs/export-pdf', [SystemLogController::class, 'exportPdf']);
});

// ---- Admin only: System settings ----
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/settings', [SystemSettingsController::class, 'show']);
    Route::put('/settings', [SystemSettingsController::class, 'update']);
});

// ---- Admin only: Reports export ----
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/reports/export', [ReportController::class, 'export']);
});

// ---- Student: Profile, COR, subjects, grades, curriculum ----
Route::middleware(['auth:sanctum', 'role:student'])->prefix('student')->group(function () {
    Route::get('/profile', [StudentProfileController::class, 'profile']);
    Route::get('/cor', [StudentProfileController::class, 'cor']);
    Route::get('/subjects', [StudentProfileController::class, 'subjects']);
    Route::get('/grades', [StudentProfileController::class, 'grades']);
    Route::get('/curriculum', [StudentProfileController::class, 'curriculum']);
    Route::get('/academic-summary', [StudentProfileController::class, 'academicSummary']);
    Route::put('/sis', [StudentProfileController::class, 'updateSis']);
});

// ---- Student: Own record requests ----
Route::middleware(['auth:sanctum', 'role:student'])->prefix('student')->group(function () {
    Route::get('/record-requests', [RecordRequestController::class, 'index']);
    Route::post('/record-requests', [RecordRequestController::class, 'store']);
    Route::get('/record-requests/{id}', [RecordRequestController::class, 'show']);
    Route::get('/record-requests/{id}/transcript', [RecordRequestController::class, 'downloadTranscript']);
    Route::get('/record-requests/{id}/approval-slip', [RequestController::class, 'downloadApprovalSlipStudent']);
});
