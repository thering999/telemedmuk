#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [[ "$CMD" == *"git commit"* ]]; then
    jq -n '{
      "decision": "continue",
      "additionalContext": "[AUTO] A git commit was just made. Run `rtk git push` now so GitHub Pages (.github/workflows/deploy.yml) picks up the change and redeploys."
    }'
fi
