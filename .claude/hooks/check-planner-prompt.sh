#!/bin/bash
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')

# ตรวจจับ keyword ที่ user พิมพ์
if echo "$PROMPT" | grep -qiE '(/planner|run planner|execute planner|ทำ task|รัน planner)'; then
    PLANNER_FILE=".claude/planner/PLANNER.md"

    if [[ ! -f "$PLANNER_FILE" ]]; then
        jq -n '{"decision": "continue", "additionalContext": "PLANNER.md not found at .claude/planner/PLANNER.md"}'
        exit 0
    fi

    PLANNER_CONTENT=$(cat "$PLANNER_FILE")
    mkdir -p ".claude/planner/report"
    REPORT_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
    REPORT_PATH=".claude/planner/report/REPORT-${REPORT_DATE}.md"

    jq -n \
      --arg content "$PLANNER_CONTENT" \
      --arg report_path "$REPORT_PATH" \
      --arg report_date "$REPORT_DATE" \
      '{
        "decision": "continue",
        "additionalContext": "[MANUAL] User requested plan execution. Execute all pending tasks, then write report to \($report_path).\n\nReport format:\n```markdown\n# Planner Report - \($report_date)\n\n## Summary\n[overall status]\n\n## Tasks\n| Task | Status | Notes |\n|------|--------|-------|\n| task name | ✅ Done / ❌ Failed / ⚠️ Skipped | details |\n\n## Errors\n[any errors encountered]\n\n## Next Steps\n[remaining or follow-up tasks]\n```\n\nPLANNER.md content:\n\n\($content)"
      }'
fi