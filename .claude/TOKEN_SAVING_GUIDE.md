# 🎯 Token Saving Guide - Telemedmuk

**Goal:** Reduce token usage by 60-90% while maintaining productivity.

---

## 1. RTK (Rust Token Killer) - MANDATORY ✅

**Already installed & configured in this project.**

### Usage Pattern
```bash
# ✅ USE (auto-routed through rtk)
rtk git status
rtk npm run dev
rtk grep "pattern" src/

# ❌ NEVER (blocked by settings.json)
git status  # → DENIED
npm run dev  # → DENIED
grep ...    # → DENIED
```

### Token Savings
- `-60%` on read operations (git status, grep, ls)
- `-40%` on build commands (npm run, tsc)
- **Total: ~70% average savings**

---

## 2. Read Tools - ALWAYS USE OVER BASH

### Preferred Tools
```
File read      → Read tool (not cat, Get-Content)
File search    → Grep tool (not grep, rg, Select-String)
File listing   → Glob tool (not ls, dir, find, Get-ChildItem)
File edit      → Edit tool (not sed, awk, nano)
```

### Token Cost Comparison
| Task | Bash | Dedicated Tool | Savings |
|------|------|---|---|
| Read 50-line file | 150 tokens | 50 tokens | -67% |
| Search 100 matches | 200 tokens | 80 tokens | -60% |
| List 20 files | 180 tokens | 40 tokens | -78% |

---

## 3. Prompt Engineering - KEEP IT TERSE

### ✅ Good (Terse)
```
"Fix TypeScript error in StrategicAnalysisView, line 85"
"Add Tabler icons to dashboard"
```

### ❌ Bad (Verbose)
```
"I'm working on a React dashboard for telemedicine data visualization...
The StrategicAnalysisView component has an error on line 85...
Can you please fix it for me?"
```

**Token Savings:** 40-60% per message

---

## 4. Batch Independent Operations

### ✅ Good (Parallel)
```bash
# All 3 commands run together if independent
rtk grep "type5" src/
rtk find public/data
rtk git status
```

### ❌ Bad (Sequential)
```
# Run one, wait for result, run next
rtk grep "type5" src/
# ... user waits ...
rtk find public/data
```

---

## 5. Code Changes - Minimal Diffs Only

### ✅ Use Edit (line-based, shows only changes)
```
Old: 15 lines of context
New: 3 lines changed
Tokens: ~80
```

### ❌ Use Write (full file rewrite)
```
Old: 0 lines
New: 500 lines
Tokens: ~800
```

**Rule:** Edit for changes, Write for new files only.

---

## 6. Skip Explanations - Output Only

### ✅ Good (Result-only)
```
✓ Fixed: removed unused imports
✓ Committed to main
✓ Deployed
```

### ❌ Bad (Narration)
```
I've analyzed the TypeScript errors and found three unused imports...
The first one is ComposedChart which was imported but never used...
Let me remove it by editing the imports section...
```

**Savings:** 50-70% per response

---

## 7. Use Latest Claude Model

When asking for complex tasks, specify:
```
Use Claude Opus 4.8 (for strategy/design)
Use Claude Sonnet 4.6 (for coding)
Use Claude Haiku 4.5 (for simple tasks)
```

---

## 8. VS Code Extensions - Reduce Context

**Installed extensions:**
- `ESLint` - catch errors before asking Claude
- `Prettier` - format automatically
- `Tailwind CSS` - avoid asking about CSS
- `GitLens` - understand git history
- `React Snippets` - faster coding

**Benefit:** Less time asking "what does this line do?"

---

## 9. Memory System - Skip Explaining Context

Use `/remember` to save patterns:
```
/remember: When uploading Excel files, always validate columns before parsing
/remember: Dashboard colors: brand-600 is teal, use for primary accent
```

Future sessions load this automatically → skip repetition.

---

## 10. Cascade LLM Pattern (When Available)

```
Layer 1 (Haiku)   → Filter/simplify input
         ↓
Layer 2 (Opus)    → Strategic output (JSON)
         ↓
Layer 3 (Sonnet)  → Expand/implement
```

**Savings:** 40-50% vs single model.

---

## 🚀 Quick Start - Today

1. **Verify RTK works:**
   ```bash
   rtk --version
   rtk git status
   ```

2. **Set model preference:**
   - Use `/fast` for Opus speed (if available)
   - Default to Haiku for quick tasks

3. **Be terse in prompts:**
   - One sentence per request
   - Provide file names, line numbers
   - Skip "please" and "thank you"

4. **Use tools correctly:**
   - Read instead of cat
   - Grep instead of grep
   - Glob instead of find

---

## 📊 Tracking Token Usage

Check RTK analytics:
```bash
rtk gain              # Show savings this session
rtk gain --history   # Show historical usage
```

---

## 🎯 Target Efficiency Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Avg tokens/change | <200 | Edit + RTK + Terse |
| Session length | 60+ min | Token savings |
| Prompts/task | 2-3 | Batch operations |
| Read operations | 0 (Bash) | Use dedicated tools |

---

**Last Updated:** 2026-06-20
**Baseline:** 70% token reduction from RTK + tools
