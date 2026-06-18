# CLAUDE.md

## RTK (Rust Token Killer)
Always prefix shell commands with `rtk`. Pattern: `<cmd> → rtk <cmd>` (e.g. `rtk ls`, `rtk git status`, `rtk grep`).
**PROHIBITED (never run raw):** `grep`, `cat`, `ls`, `find`, `tree`, `git`, `gh`, `npm`, `npx`, `pnpm`, `bun`, `docker`, `curl`, `wget`, `tsc`, `eslint`, `prettier`, `prisma`, `next`
Never fallback to native commands. If rtk fails, notify user immediately — do not run the raw command.

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
