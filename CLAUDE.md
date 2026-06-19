# CLAUDE.md

## Token Efficiency (strict)

- Default to terse replies. No restating the request, no "Here's what I'll do" preamble, no trailing recap unless the user asks for one.
- Skip narrating routine/successful steps (build passed, lint passed, staged files) — only report failures, deviations, or numbers the user needs to verify.
- Don't re-explain context already established earlier in the conversation.
- For Q&A (non-coding questions), answer in the fewest words that fully answer it — no headers/bullets for a one-line answer.
- Still ask before anything risky/destructive (per global safety rules) — brevity never skips a needed confirmation.

## RTK (Rust Token Killer)
Always prefix shell commands with `rtk`. Pattern: `<cmd> → rtk <cmd>` (e.g. `rtk ls`, `rtk git status`, `rtk grep`).
**PROHIBITED (never run raw):** `grep`, `cat`, `ls`, `find`, `tree`, `git`, `gh`, `npm`, `npx`, `pnpm`, `bun`, `docker`, `curl`, `wget`, `tsc`, `eslint`, `prettier`, `prisma`, `next`
Never fallback to native commands. If rtk fails, notify user immediately — do not run the raw command.
Global rtk config (`~/.rtk/config.toml` / `%APPDATA%\rtk\config.toml`) is tuned for max squeeze: colors/emoji off, max_width=80, tightened grep/status/passthrough limits. Don't loosen these without being asked.

## File Operations
- **Reading:** Use `rtk smart <file>` to understand a file — avoid `Read` (full dump) unless full content is needed.
- **Editing:** Use `Edit` (line-based) for partial edits — avoid `Write` (full rewrite). Use `Write` only for new files.

## Repository Layout
- `.agents/rules/` — agent rule files
- `.claude/` — Claude Code project settings

## Planner Workflow
When PLANNER.md changes or user runs `/project:planner`:
1. Read `.claude/planner/PLANNER.md` in full
2. Execute each task in order
3. Write report to `.claude/planner/report/REPORT-[date].md`
4. Notify user of report location

Report fields: Summary, Tasks (status ✅❌⚠️ + notes), Errors, Next Steps.
Rules: Never skip tasks. If a task fails, log it and continue — never stop.
