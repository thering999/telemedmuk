## ทำงานแบบ Loops 
- เฝ้าดูไฟล์ PLANNER.md คอยดู Task ที่กำหนดให้ และดำเนินการตามนั้น
- ถ้ามีคำถามให้ตอบกลับที่ PLANNER.md แล้วรอ user ตอบกลับมาใหม่
- ให้ Test code หลังการแก้ไขเสร็จทุกครั้ง
- ให้ Run lintjs ทุกครั้ง หลังจากแก้ไขหรือสร้างไฟล์
- หากไม่สามารถดำเนินการใดได้ หรือ สิทธิ์ไม่ถึง 
  ให้แจ้งใน PLANNER.md แล้วรอ user ตอบกลับมาใหม่

## Scope 
- คุณคือ Coder Expert ด้าน NextJS , Typescript , Tailwind CSS , BunJS และ SQLite
- คุณคือ Fullstack Developer

# Login Page : FINISH
1. สร้างหน้า login แบบ mockup ไม่ต้องเชื่อมต่อฐานข้อมูล
2. ใช้ nextjs v16 , tailwind-css v4, typescript
3. ขอ design แบบ เรียบหรู
4. ใช้ bunjs v ล่าสุด
5. สร้าง sqlite ง่ายๆ มี table user สร้าง user admin , pass admin ในนั้น แล้วทำ logic ที่เชื่อมต่อฐานข้อมูลจริงๆ
6. login success ให้แสดงผลหน้า welcome

# Home Page

## Tasks
- [x] Design Database Schema for API Sources and Dashboard Cards
- [x] Implement API Source Management UI (CRUD)
- [x] Create Home Page Shell with Navigation
- [x] Implement Dynamic Dashboard Card Component (Support Metric, Table, Graph)
- [x] Add Card Configuration Modal
- [x] Integrate HDC Open Data API Data Fetching
- [x] Add Polish and Animations (Framer Motion)

# Phase 4: Hybrid RAG Search & Optimization

## Tasks
- [x] Implement Strict RAG File Exclusions (Ignore Developer Guides, Webpack/Package Files, and Excel Audits in User Search)
- [x] Integrate Dynamic Query Helper Keywords (Semantic boosting for ADDRESS, ANC, person, chronic tables, etc.)
- [x] Implement Active Audit Error Correlation (Detect current file errors in query and display inline summary)
- [x] Embed High-Fidelity Glassmorphism Cards for Tool Downloads (DATACORRECT & EXCHANGE)

# Phase 5: Executive Dashboard & Advanced Reporting

## Tasks
- [x] Implement Chart.js / D3.js Data Visualization for Error Trends
- [x] Build a Persistent Historical Offline Cache (IndexedDB) for RAG Analytics
- [x] Refine the PDF Export Engine for High-Fidelity Printer-Friendly Executive Summaries
- [x] Integrate KPI Target Mapping (Green/Red visual indicators for passing/failing KPI clusters)

# Phase 6: Agentic RAG Deep Problem-Solving & AI Remedies

## Tasks
- [x] Implement Agentic RAG Query Routing (Dynamically route errors to SQL templates or DataCorrect steps)
- [x] Generate Automated SQL Fixes (Tailored SQL scripts for specific HIS like JHCIS, HOSxP based on audit errors)
- [x] Embed Step-by-step HIS Workflows (Interactive UI showing where to click to fix common data entry errors)
- [x] Build "One-Click AI Remedy" Button (A button next to critical errors that triggers deep Agentic resolution)

# Phase 7: Advanced Automation & Smart Execution

## Tasks
- [x] Implement System-Wide Notification UI (Real-time toast notifications for AI task progress and copy events)
- [x] Build SQL Snippet Library (Automatically save AI-generated SQL into IndexedDB for quick reuse)
- [x] Enhance Offline RAG Highlighting (Highlight query keywords in RAG document previews for faster reading)

# Phase 8: Offline AI & Mini-Agent Expansion

## Tasks
- [x] Implement Offline KPI Predictor (Predict impact of data errors before submission)
- [x] Local SQL Auto-Healer (Run fixing scripts locally without sending data to AI)
- [x] Export Audit Summary as PDF (With AI actionable insights)
- [x] Enhance Voice-to-Text Interaction (Expand voice commands for navigating the audit dashboard)

# Phase 9: AI Self-Learning Auto-RAG (Cache & Memory)

## Tasks
- [x] Auto-Cache AI Analyses (Store problem signature + AI response to `localStorage` when analyzing audits)
- [x] Self-Learning Query Interceptor (When user asks a similar question about the same errors, return the cached AI response instantly)
- [x] Bypass API Exhaustion loops (Skip Local FreeLLM fallback in non-localhost cloud environments to prevent 100s timeouts)
- [x] Condense Context Tokens (Prevent massive deepLogic JSON payload from triggering token limit exhaustion)

# Phase 10: Seamless AI Agent Integration & RAG Report Hiding

## Tasks
- [x] Hide `HDC_Audit_Detailed_Report_*.xlsx` and report/developer file names from RAG Explorer UI, keeping them as background KM.
- [x] Intercept floating MOPH Bot Chat queries to route to the offline RAG audit engine when querying about current audit results or KPIs.
- [x] Add an "Ask Online AI" escalation button inside MOPH Bot Chat responses for seamless online fallback.
- [x] Automate the "ส่งให้ AI ออนไลน์วิเคราะห์ต่อ (Gemini)" action in the pre-summary panel to immediately submit the query.
- [x] Run verification tests and linting to ensure system integrity.

# Phase 11: RAG & Audit Engine Accuracy, Coverage, and Performance

## Tasks
### Detection Accuracy (validator.js)
- [x] Review existing audit error rules in `validator.js` against real audit samples (e.g. `hdc_ai_result_2026-06-10.txt`, `debug_no_cards_page_*.html`) and list data-quality patterns currently missed
- [x] Add/expand rules for missed patterns (cross-table mismatches, date logic, new HIS schema fields) — found `mapErrorToHdcAiTerm` never mapped REQ ("ขาดข้อมูลบังคับ") or FMT ("รูปแบบไม่ถูกต้อง") error codes, and the CRC check's loose `"CID"` substring match could misclassify FMT-with-`(CID)`-suffix messages; fixed both
- [x] Add regression test cases for each new rule — `tests/test_mapErrorToHdcAiTerm.js`

### Knowledge Base Expansion (RAG)
- [x] Identify new source documents/manuals not yet ingested into `rag_knowledge.json`/`rag_knowledge.js` (updated HDC manuals, new table specs, KPI rule changes) — audited all 86 files under `RAG/`; all genuinely text-bearing manuals are already ingested (78 sources), the only gaps are intentional dev-file exclusions, one unsupported image, and one image-only PPTX with no text layer (needs OCR, out of scope)
- [x] Update `rag_builder.py` to parse and embed the new sources — added explicit logging of skipped low/no-content files so future image-only or extraction-failed sources are visible instead of silently dropped
- [x] Verify RAG search surfaces the newly ingested content correctly (manual spot-check queries) — N/A this run (no new ingestable content found); confirmed existing sources resolve correctly during the audit

### Performance & Token Efficiency
- [x] Profile RAG query response time end-to-end and identify slow paths — found `queryLocalRAG` re-ran `.toLowerCase()` over all ~1,812 RAG chunks (~1.8M chars) on every single query; benchmarked ~7.15ms/query vs ~2.85ms/query when cached
- [x] Reduce payload size sent to AI per query (trim unneeded context fields, paginate large result sets) — capped the per-table KPI/error-correlation blocks to top 5 matches (previously unbounded across ~19 `TABLE_KPI_MAP` tables), mirroring the existing top-3 cap on RAG chunk matches
- [x] Extend the Phase 9 self-learning cache to cover more repeated/common audit query patterns — found the cache lookup was reading a dead `localStorage` key that `initRagCacheDB()` deletes after one-time migration to IndexedDB, making the self-learning cache permanently a no-op; fixed to read `window.MEMORY_RAG_CACHE`

- [x] Run verification tests and linting (per CLAUDE.md Planner Workflow rules) after each sub-task above — see `.claude/planner/report/REPORT-2026-06-17.md`

# Phase 12: plandev.md Backlog Audit & Live Smoke Test

## Tasks
- [x] Audit `plandev.md` backlog (accumulated user feature requests across multiple sessions) against current codebase to find genuinely unimplemented items
- [x] Close RTK enforcement gap: `.claude/settings.json` deny list only covered the Bash tool, not PowerShell — raw `git`/`npm`/etc. via PowerShell tool slipped through unblocked
- [x] Live browser smoke test (real Chromium via Playwright, not just `node --check`) of the "ส่งให้ AI วิเคราะห์ต่อ" pre-summary flow, KPI mapping, and tool zip downloads
- [x] OCR support for image-only RAG sources (e.g. `NCDSCREEN...pptx`) — installed Tesseract OCR (system binary) + Thai language data, added `extract_pptx_images_ocr()` fallback in `rag_builder.py`, rebuilt `rag_knowledge.js`/`.json` (1,818 chunks, up from 1,812)
