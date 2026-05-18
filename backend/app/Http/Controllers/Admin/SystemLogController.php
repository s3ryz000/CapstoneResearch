<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\AuthorizesRole;
use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SystemLogController extends Controller
{
    use AuthorizesRole;

    //
    public function index(Request $request) : JsonResponse
    {
        try {
            if($err = $this->requireAuth()) {
                return $err;
            }
            if($err = $this->requireRoles($request->user(), ['admin'])) {
                return $err;
            }
            $query = SystemLog::query();

            $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
            $logs = $query->paginate($perPage);


            return response()->json($logs);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to get system logs', 'error' => $e->getMessage()], 500);
        }
    }

    public function exportPdf(Request $request): StreamedResponse|JsonResponse
    {
        if ($err = $this->requireAuth()) {
            return $err;
        }
        if ($err = $this->requireRoles($request->user(), ['admin'])) {
            return $err;
        }

        $logs        = SystemLog::orderBy('created_at', 'desc')->get();
        $generatedAt = now()->format('F d, Y h:i A');
        $total       = $logs->count();

        $e = fn(string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $rows = '';
        foreach ($logs as $log) {
            $bg   = ($log->log_id % 2 === 0) ? 'background:#f9f9f9;' : '';
            $rows .= '<tr style="' . $bg . '">'
                . '<td style="padding:4px 6px;border-bottom:0.4pt solid #ddd;white-space:nowrap;">' . $e((string) ($log->log_id ?? '')) . '</td>'
                . '<td style="padding:4px 6px;border-bottom:0.4pt solid #ddd;word-break:break-word;">' . $e((string) ($log->action ?? '')) . '</td>'
                . '<td style="padding:4px 6px;border-bottom:0.4pt solid #ddd;">' . $e((string) ($log->user_id ?? '')) . '</td>'
                . '<td style="padding:4px 6px;border-bottom:0.4pt solid #ddd;">' . $e((string) ($log->role ?? '')) . '</td>'
                . '<td style="padding:4px 6px;border-bottom:0.4pt solid #ddd;white-space:nowrap;">' . $e($log->created_at ? $log->created_at->format('Y-m-d H:i:s') : '') . '</td>'
                . '</tr>';
        }

        $thStyle  = 'padding:5px 6px;text-align:left;background:#7a0000;color:#fff;font-size:7.5pt;';
        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 16mm 12mm; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 7.5pt; color: #111; margin:0; }
  .watermark {
    position: fixed; top: 46%; left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 26pt; font-weight: bold;
    color: rgba(150,0,0,0.07);
    white-space: nowrap; z-index: -1;
    font-family: DejaVu Sans, sans-serif;
  }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.c1 { width: 6%; }
  col.c2 { width: 50%; }
  col.c3 { width: 8%; }
  col.c4 { width: 10%; }
  col.c5 { width: 17%; }
</style>
</head>
<body>
  <div class="watermark">ADMIN AUDIT LOG – DO NOT TAMPER</div>

  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:12pt;font-weight:bold;">Trece Martires City College</div>
    <div style="font-size:10pt;font-weight:bold;margin-top:2px;">Admin Audit Log</div>
    <div style="font-size:7.5pt;color:#555;margin-top:2px;">Automated Student Records Management System</div>
  </div>

  <div style="font-size:7pt;color:#555;margin-bottom:8px;">
    Generated: {$generatedAt} &nbsp;|&nbsp; Total entries: {$total}
  </div>

  <table>
    <colgroup>
      <col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5">
    </colgroup>
    <thead>
      <tr>
        <th style="{$thStyle}">Log ID</th>
        <th style="{$thStyle}">Action</th>
        <th style="{$thStyle}">User ID</th>
        <th style="{$thStyle}">Role</th>
        <th style="{$thStyle}">Timestamp</th>
      </tr>
    </thead>
    <tbody>
      {$rows}
    </tbody>
  </table>
</body>
</html>
HTML;

        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        $pdfOutput = $dompdf->output();
        $filename  = 'AUDIT_LOG_' . now()->format('Ymd_His') . '.pdf';

        return response()->streamDownload(
            function () use ($pdfOutput) { echo $pdfOutput; },
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }
}
