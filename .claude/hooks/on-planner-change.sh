#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

if [[ "$FILE_PATH" == *".claude/planner/PLANNER.md" ]]; then
    PLANNER_CONTENT=$(cat ".claude/planner/PLANNER.md")
    mkdir -p ".claude/planner/report"
    REPORT_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
    REPORT_PATH=".claude/planner/report/REPORT-${REPORT_DATE}.md"

    jq -n \
      --arg content "$PLANNER_CONTENT" \
      --arg report_path "$REPORT_PATH" \
      --arg report_date "$REPORT_DATE" \
      '{
        "decision": "continue",
        "additionalContext": "[AUTO] PLANNER.md changed. Execute all pending tasks, then write report to \($report_path).\n\nReport format:\n```markdown\n# Planner Report - \($report_date)\n\n## Summary\n[overall status]\n\n## Tasks\n| Task | Status | Notes |\n|------|--------|-------|\n| task name | ✅ Done / ❌ Failed / ⚠️ Skipped | details |\n\n## Errors\n[any errors encountered]\n\n## Next Steps\n[remaining or follow-up tasks]\n```\n\nPLANNER.md content:\n\n\($content)"
      }'
fi