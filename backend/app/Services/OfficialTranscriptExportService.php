<?php

namespace App\Services;

use App\Models\Student;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OfficialTranscriptExportService
{
    public function streamForStudent(Student $student): StreamedResponse
    {
        $student->loadMissing(['program', 'grades.subject']);

        $docId       = sprintf('TOR-%s-%06d', now()->format('Y'), $student->student_id);
        $generatedAt = now()->format('F j, Y g:i A');

        $filename = sprintf(
            'OFFICIAL_TRANSCRIPT_OF_RECORD_%s_%s.pdf',
            Str::upper((string) ($student->student_number ?? 'STUDENT')),
            now()->format('Ymd_His')
        );

        $options = new Options();
        $options->set('defaultFont', 'DejaVu Serif');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->buildHtml($student, $docId, $generatedAt));
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $pdf = $dompdf->output();

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf;
        }, $filename, ['Content-Type' => 'application/pdf']);
    }

    private function buildHtml(Student $student, string $docId, string $generatedAt): string
    {
        $e = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');

        // ── Logo (base64-embed so dompdf can render it without remote access) ───
        $logoPath = public_path('assets/logo.png');
        if (file_exists($logoPath)) {
            $logoData = base64_encode(file_get_contents($logoPath));
            $logoHtml = '<img src="data:image/png;base64,' . $logoData
                . '" style="width:68px;height:68px;border-radius:34px;">';
        } else {
            $logoHtml = '<div style="width:68px;height:68px;border:2pt solid #000;border-radius:34px;'
                . 'line-height:68px;text-align:center;font-size:5.5pt;color:#aaa;'
                . 'font-family:DejaVu Sans,sans-serif;">LOGO</div>';
        }

        // ── Pre-compute all variables (no function calls inside heredoc) ────────

        $rawName = Str::upper(trim(implode(', ', array_filter([
            $student->last_name,
            trim(implode(' ', array_filter([$student->first_name, $student->middle_name]))),
        ]))));
        $name = $e($rawName);

        $studentNo    = $e($student->student_number);
        $address      = $e($student->address);
        $placeOfBirth = $e($student->place_of_birth);
        $dob          = $e($this->formatDate($student->date_of_birth));
        $sex          = $student->sex === 'M' ? 'MALE' : ($student->sex === 'F' ? 'FEMALE' : $e($student->sex));
        $citizenship  = $e($student->citizenship);
        $guardian     = $e($student->guardian_name);

        $elemSchool     = $e($student->elementary_school);
        $elemYear       = $e($student->elementary_year);
        $highSchool     = $e($student->high_school);
        $highSchoolYear = $e($student->high_school_year);
        $prevSchool     = $e(Str::upper((string) ($student->previous_school ?? '')));
        $prevCourse     = $e(Str::upper((string) ($student->previous_course ?? '')));

        $program    = Str::upper($e($student->program?->name ?? $student->program?->code ?? ''));
        $enrollDate = $e($this->formatDate($student->enrollment_date));
        $gradDate   = $e($this->formatDate($student->graduation_date));
        $gpa        = $student->GPA !== null ? number_format((float) $student->GPA, 2) : '';

        // ── Build academic table rows ─────────────────────────────────────────

        $grades = $student->grades
            ->sortBy(fn($g) => sprintf(
                '%s-%02d-%s',
                $g->academic_year,
                $this->semesterRank((string) $g->semester),
                $g->subject?->code ?? ''
            ))
            ->values();

        // Helper to build a descriptor-only row (period header / institution info)
        $descRow = fn(string $html, bool $bold = false, string $size = '7pt') =>
            '<tr>'
            . '<td style="border:0.5pt solid #000;padding:1px 3px;"></td>'
            . '<td style="border:0.5pt solid #000;padding:2px 5px;text-align:center;'
            . ($bold ? 'font-weight:bold;' : '')
            . 'font-size:' . $size . ';">' . $html . '</td>'
            . '<td style="border:0.5pt solid #000;"></td>'
            . '<td style="border:0.5pt solid #000;"></td>'
            . '<td style="border:0.5pt solid #000;"></td>'
            . '</tr>';

        $gradeTableRows = '';

        // Previous institution block
        if ($student->previous_course || $student->previous_school) {
            if ($student->previous_course) {
                $gradeTableRows .= $descRow($prevCourse, false, '6.5pt');
            }
            if ($student->previous_school) {
                $gradeTableRows .= $descRow($prevSchool, true, '7pt');
            }
            // Dashed separator
            $gradeTableRows .= '<tr>'
                . '<td colspan="5" style="border-left:0.5pt solid #000;border-right:0.5pt solid #000;'
                . 'border-bottom:0.5pt dashed #555;height:5px;padding:0;font-size:1pt;">&nbsp;</td>'
                . '</tr>';
        }

        // TMCC institution header
        $gradeTableRows .= $descRow('TRECE MARTIRES CITY COLLEGE', true, '7pt');
        $gradeTableRows .= $descRow('TRECE MARTIRES CITY, CAVITE', false, '6.5pt');

        // Grade rows grouped by period
        $currentPeriod = null;
        foreach ($grades as $grade) {
            $period = Str::upper((string) ($grade->semester ?? '')) . ' - ' . ($grade->academic_year ?? '');

            if ($period !== $currentPeriod) {
                $gradeTableRows .= $descRow(
                    htmlspecialchars($period, ENT_QUOTES, 'UTF-8'),
                    true,
                    '6.5pt'
                );
                $currentPeriod = $period;
            }

            $gradeVal = $grade->grade_value !== null
                ? number_format((float) $grade->grade_value, 2)
                : $e($grade->remarks ?? '');

            $units = $grade->subject?->units !== null
                ? number_format((float) $grade->subject->units, 2)
                : '';

            $gradeTableRows .= '<tr>'
                . '<td style="border:0.5pt solid #000;padding:1px 4px;font-size:7pt;">' . $e($grade->subject?->code) . '</td>'
                . '<td style="border:0.5pt solid #000;padding:1px 5px;font-size:7pt;">' . $e($grade->subject?->title) . '</td>'
                . '<td style="border:0.5pt solid #000;padding:1px 4px;text-align:center;font-size:7pt;">' . $gradeVal . '</td>'
                . '<td style="border:0.5pt solid #000;padding:1px 4px;text-align:center;font-size:7pt;"></td>'
                . '<td style="border:0.5pt solid #000;padding:1px 4px;text-align:center;font-size:7pt;">' . $units . '</td>'
                . '</tr>';
        }

        if ($grades->isEmpty()) {
            $gradeTableRows .= '<tr>'
                . '<td colspan="5" style="border:0.5pt solid #000;padding:8px;text-align:center;color:#666;font-size:7pt;">No grade records on file.</td>'
                . '</tr>';
        }

        // ── HTML template ─────────────────────────────────────────────────────

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { margin: 15mm 18mm 18mm 18mm; }
body { font-family: DejaVu Serif, serif; font-size: 9pt; color: #000; line-height: 1.42; }

/* Watermark */
.wm {
    position: fixed; top: 32%; left: -12%; width: 124%; text-align: center;
    font-size: 68pt; font-weight: bold; color: rgba(0,0,0,0.04);
    transform: rotate(-38deg); z-index: -100;
    letter-spacing: 10px; white-space: nowrap; font-family: DejaVu Sans, sans-serif;
}

/* Fixed footer */
.ftr { position: fixed; bottom: 0; left: 0; right: 0; border-top: 0.5pt solid #aaa; padding-top: 2px; }
.ftr td { font-size: 5.5pt; color: #777; font-family: DejaVu Sans, sans-serif; }

/* Page header */
.hdr { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.hdr td { vertical-align: middle; padding: 0; }
.logo-td { width: 80px; vertical-align: middle; }
.sch { padding-left: 10px; }
.sch-name { font-size: 12pt; font-weight: bold; }
.sch-addr { font-size: 8pt; }
.sch-reg  { font-size: 9pt; font-weight: bold; margin-top: 3px; }

/* Document title */
.doc-title { text-align: center; font-size: 16pt; font-weight: bold; text-decoration: underline; margin: 7px 0 12px; }

/* Section labels */
.sec { font-weight: bold; text-decoration: underline; font-size: 9pt; margin: 8px 0 2px; }

/* Info rows (label : value, no visible cell borders) */
.it { width: 100%; border-collapse: collapse; }
.it td { padding: 1px 0; font-size: 9pt; vertical-align: top; }
.lb { width: 148px; font-weight: normal; }
.vl { font-weight: bold; }

/* Academic table */
.at { width: 100%; border-collapse: collapse; margin-top: 6px; }
.at th { border: 0.5pt solid #000; padding: 2px 4px; font-size: 7.5pt; font-weight: bold; text-align: center; }
.at td { border: 0.5pt solid #000; padding: 1px 4px; font-size: 7pt; vertical-align: top; }

/* Page break */
.pb { page-break-before: always; }
</style>
</head>
<body>

<div class="wm">OFFICIAL COPY</div>

<!-- Fixed footer every page -->
<div class="ftr">
<table style="width:100%;border-collapse:collapse;"><tr>
  <td><strong>Document ID:</strong> {$docId}</td>
  <td style="text-align:right"><strong>Generated:</strong> {$generatedAt}</td>
</tr></table>
</div>

<!-- ══════════════════════════ PAGE 1 ══════════════════════════ -->

<table class="hdr"><tr>
  <td class="logo-td">{$logoHtml}</td>
  <td class="sch">
    <div class="sch-name">TRECE MARTIRES CITY COLLEGE</div>
    <div class="sch-addr">Trece Indang Rd. Brgy. Luciano</div>
    <div class="sch-addr">Trece Martires City, Cavite</div>
    <div class="sch-reg">OFFICE OF THE REGISTRAR</div>
  </td>
</tr></table>

<div class="doc-title">OFFICIAL TRANSCRIPT OF RECORD</div>

<div class="sec">PERSONAL INFORMATION:</div>
<table class="it">
<tr><td class="lb">Student Name:</td><td class="vl">{$name}</td></tr>
<tr><td class="lb">Address:</td><td class="vl">{$address}</td></tr>
<tr><td class="lb">Place of Birth:</td><td class="vl">{$placeOfBirth}</td></tr>
<tr><td class="lb">Sex:</td><td class="vl">{$sex}</td></tr>
<tr><td class="lb">Date of Birth:</td><td class="vl">{$dob}</td></tr>
<tr><td class="lb">Name of Guardian:</td><td class="vl">{$guardian}</td></tr>
<tr><td class="lb">Citizenship:</td><td class="vl">{$citizenship}</td></tr>
</table>

<div class="sec">ENTRANCE DATA</div>
<table class="it">
<tr>
  <td class="lb">Elementary School:</td>
  <td class="vl">{$elemSchool}</td>
  <td style="width:40px;text-align:right;font-weight:bold;font-size:9pt;">{$elemYear}</td>
</tr>
<tr>
  <td class="lb">High School:</td>
  <td class="vl">{$highSchool}</td>
  <td style="width:40px;text-align:right;font-weight:bold;font-size:9pt;">{$highSchoolYear}</td>
</tr>
<tr><td class="lb">Previous School:</td><td class="vl" colspan="2">{$prevSchool}</td></tr>
<tr><td class="lb">Previous Course:</td><td class="vl" colspan="2">{$prevCourse}</td></tr>
<tr><td class="lb">Admission Credential:</td><td colspan="2"></td></tr>
<tr><td class="lb">Date of Admission:</td><td class="vl" colspan="2">{$enrollDate}</td></tr>
</table>

<div class="sec">GRADUATION DATA</div>
<table class="it">
<tr>
  <td class="lb">DEGREE:</td>
  <td style="font-weight:bold;text-align:center;font-size:9pt;">{$program}</td>
</tr>
<tr><td class="lb">Date of Graduation:</td><td class="vl">{$gradDate}</td></tr>
<tr><td class="lb">S.O. Number:</td><td></td></tr>
<tr><td class="lb">Remarks:</td><td></td></tr>
</table>

<div class="sec" style="margin-left:55px;">GRADING SYSTEM:</div>
<table style="border-collapse:collapse;margin-left:55px;margin-top:2px;">
<tr>
  <td style="width:195px;font-size:8.5pt;padding:1px 0;">1.00 - 1.25 - Excellent</td>
  <td style="font-size:8.5pt;padding:1px 0;">4.00 = Conditional / Failure</td>
</tr>
<tr>
  <td style="font-size:8.5pt;padding:1px 0;">1.50 - 1.75 = Very Good</td>
  <td style="font-size:8.5pt;padding:1px 0;">5.00 - Failed</td>
</tr>
<tr>
  <td style="font-size:8.5pt;padding:1px 0;">2.00 - 2.25 = Good</td>
  <td style="font-size:8.5pt;padding:1px 0;">Inc - Incomplete</td>
</tr>
<tr>
  <td style="font-size:8.5pt;padding:1px 0;">2.50 - 2.75 = Satisfactory</td>
  <td style="font-size:8.5pt;padding:1px 0;">DRP = Dropped</td>
</tr>
<tr>
  <td style="font-size:8.5pt;padding:1px 0;">3.0 = Passing</td>
  <td></td>
</tr>
</table>

<div style="text-align:center;letter-spacing:4px;font-size:10pt;text-decoration:underline;margin:10px 0 6px;">C E R T I F I C A T I O N</div>
<div style="text-align:center;font-size:8.5pt;line-height:1.85;">
  I HEREBY CERTIFY THAT THE FOREGOING RECORDS OF<br>
  <strong style="font-size:11pt;">{$name}</strong><br>
  A STUDENT OF THIS COLLEGE HAVE BEEN VERIFIED BY ME AND THAT THE TRUE COPIES OF THE OFFICIAL RECORDS<br>
  SUBSTANTIATING THE SAME ARE KEPT IN THE FILES OF THE COLLEGE.
</div>

<table style="width:100%;border-collapse:collapse;margin-top:20px;">
<tr>
  <td style="width:45%;font-size:9pt;">Prepared:</td>
  <td style="width:10%;"></td>
  <td style="width:45%;font-size:9pt;">Certified Correct:</td>
</tr>
<tr>
  <td style="padding-top:22px;vertical-align:bottom;">
    <div style="border-bottom:0.5pt solid #000;width:155px;height:1px;"></div>
  </td>
  <td></td>
  <td style="padding-top:12px;vertical-align:bottom;">
    <div style="border-bottom:0.5pt solid #000;width:190px;padding-bottom:1px;font-weight:bold;font-size:9pt;">REGISTRAR</div>
    <div style="font-size:8.5pt;width:190px;text-align:center;margin-top:1px;">Registrar</div>
  </td>
</tr>
</table>

<div style="font-size:8pt;margin-top:10px;">Page 1 of 2</div>

<!-- ══════════════════════════ PAGE 2 ══════════════════════════ -->
<div class="pb"></div>

<table class="hdr"><tr>
  <td class="logo-td">{$logoHtml}</td>
  <td class="sch">
    <div class="sch-name">TRECE MARTIRES CITY COLLEGE</div>
    <div class="sch-addr">Trece Indang Rd. Brgy. Luciano</div>
    <div class="sch-addr">Trece Martires City, Cavite</div>
    <div class="sch-reg">OFFICE OF THE REGISTRAR</div>
  </td>
</tr></table>

<div class="doc-title">OFFICIAL TRANSCRIPT OF RECORD</div>

<div style="font-size:9pt;margin-bottom:5px;">Name:&nbsp;&nbsp;&nbsp;{$name}</div>

<table class="at">
<thead>
<tr>
  <th rowspan="2" style="width:65px;">COURSE<br>CODE</th>
  <th rowspan="2">DESCRIPTION</th>
  <th colspan="2">GRADES</th>
  <th rowspan="2" style="width:45px;">CREDIT</th>
</tr>
<tr>
  <th style="width:42px;">Final</th>
  <th style="width:50px;">Re-Exam</th>
</tr>
</thead>
<tbody>
{$gradeTableRows}
<tr>
  <td colspan="5" style="border:0.5pt solid #000;padding:5px;text-align:center;font-size:7.5pt;">xxx NOTHING FOLLOWS xxx</td>
</tr>
</tbody>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:20px;">
<tr>
  <td style="width:45%;font-size:9pt;">Prepared:</td>
  <td style="width:10%;"></td>
  <td style="width:45%;font-size:9pt;">Certified Correct:</td>
</tr>
<tr>
  <td style="padding-top:22px;vertical-align:bottom;">
    <div style="border-bottom:0.5pt solid #000;width:155px;height:1px;"></div>
  </td>
  <td></td>
  <td style="padding-top:12px;vertical-align:bottom;">
    <div style="border-bottom:0.5pt solid #000;width:190px;padding-bottom:1px;font-weight:bold;font-size:9pt;">REGISTRAR</div>
    <div style="font-size:8.5pt;width:190px;text-align:center;margin-top:1px;">Registrar</div>
  </td>
</tr>
</table>

<div style="font-size:8pt;margin-top:10px;">Page 2 of 2</div>

</body>
</html>
HTML;
    }

    private function formatDate(mixed $value): string
    {
        if (! $value) {
            return '';
        }
        try {
            return Carbon::parse($value)->format('F j, Y');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    private function semesterRank(string $semester): int
    {
        $normalized = Str::lower(trim($semester));
        return match (true) {
            str_contains($normalized, '1') || str_contains($normalized, 'first')  => 1,
            str_contains($normalized, '2') || str_contains($normalized, 'second') => 2,
            str_contains($normalized, '3') || str_contains($normalized, 'third')  => 3,
            default => 9,
        };
    }
}
