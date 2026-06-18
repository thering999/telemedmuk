# อ่าน JSON จาก stdin
$input_data = $input | Out-String
$json = $input_data | ConvertFrom-Json

$prompt = $json.prompt
if (-not $prompt) { $prompt = "" }

# ตรวจจับ keyword ที่ user พิมพ์
if ($prompt -match '(/planner|run planner|execute planner|ทำ task|รัน planner)') {

    $planner_file = ".claude/planner/PLANNER.md"

    if (-not (Test-Path $planner_file)) {
        @{
            decision          = "continue"
            additionalContext = "PLANNER.md not found at .claude/planner/PLANNER.md"
        } | ConvertTo-Json
        exit 0
    }

    $planner_content = Get-Content $planner_file -Raw

    # สร้างโฟลเดอร์ report ถ้ายังไม่มี
    $report_dir = ".claude/planner/report"
    if (-not (Test-Path $report_dir)) {
        New-Item -ItemType Directory -Path $report_dir -Force | Out-Null
    }

    $report_date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $report_path = "$report_dir/REPORT-$report_date.md"

    $report_template = @"
# Planner Report - $report_date

## Summary
[overall status]

## Tasks
| Task | Status | Notes |
|------|--------|-------|
| task name | ✅ Done / ❌ Failed / ⚠️ Skipped | details |

## Errors
[any errors encountered]

## Next Steps
[remaining or follow-up tasks]
"@

    @{
        decision          = "continue"
        additionalContext = "[MANUAL] User requested plan execution. Execute all pending tasks, then write report to $report_path.`n`nReport format:`n$report_template`n`nPLANNER.md content:`n`n$planner_content"
    } | ConvertTo-Json

}