import { useRef, useState } from 'react'
import type { ReportCategory, Snapshot } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { ParseHippoExcelError, detectCategory, detectCategoryByColumns, parseFilenameMeta, parseHippoExcelFile } from '../lib/parseHippoExcel'
import { validateSnapshot, validateGenericCategoryFile, type ValidationReport } from '../lib/validateSnapshot'
import { ADMIN_PASSWORD } from '../lib/adminAuth'
import SnapshotView from './SnapshotView'
import * as XLSX from 'xlsx'

type FileSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; actionsUrl: string }
  | { status: 'error'; message: string }

interface SelectedFile {
  /** Stable per-file key for React lists and state updates (filename can
   * collide in theory, e.g. re-adding the same browser dedup-suffixed file,
   * so a counter-based id is used instead of the filename itself). */
  id: string
  filename: string
  category: ReportCategory | 'base' | null
  /** Raw bytes of the originally-uploaded file, kept so the GitHub publish
   * flow can base64-encode and commit the exact same bytes without
   * re-reading the File a second time. */
  buffer: ArrayBuffer
  previewSnapshot?: Snapshot
  previewError?: string
  /** Only computed when previewSnapshot exists (validation runs on the parsed "base" shape). */
  validation?: ValidationReport
  dateWasGuessed: boolean
  selected: boolean
  saveState: FileSaveState
}

const GITHUB_OWNER = 'thering999'
const GITHUB_REPO = 'telemedmuk'

const SAVE_WORKER_URL = import.meta.env.VITE_SAVE_WORKER_URL ?? ''
const APP_SHARED_KEY = import.meta.env.VITE_APP_SHARED_KEY ?? ''

const DEFAULT_ACTIONS_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`

const CATEGORY_LABELS: Record<ReportCategory | 'base', string> = {
  base: 'ภาพรวม',
  typein: 'ข้อมูลเกณฑ์จาก PH-EOC',
  all: 'แยกประเภทบริการ',
  person: 'รายคน',
  ncd: 'NCD',
  mch: 'MCH',
  ltc_pal: 'LTC/Palliative',
  followup: 'ติดตามต่อเนื่อง',
}

const UNKNOWN_CATEGORY_LABEL = 'ไม่รู้จักรูปแบบไฟล์นี้'

function categoryLabel(category: ReportCategory | 'base' | null): string {
  if (category === null) return UNKNOWN_CATEGORY_LABEL
  return CATEGORY_LABELS[category]
}

/** Browser-safe base64 encoding of an ArrayBuffer without spreading huge
 * arrays into String.fromCharCode (which can blow the call stack on larger
 * files). Builds the binary string in small chunks instead. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x2000 // 8KB
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

interface SaveSnapshotResponseBody {
  ok: boolean
  actionsUrl?: string
  error?: string
}

let nextFileId = 0

function ImportExcelTab() {
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [batchSummary, setBatchSummary] = useState<string | null>(null)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUnlock = () => {
    if (pinInput === ADMIN_PASSWORD) {
      setIsUnlocked(true)
      setPinError('')
      setPinInput('')
    } else {
      setPinError('รหัสไม่ถูกต้อง')
    }
  }

  const readFileAsEntry = (file: File): Promise<SelectedFile> => {
    return new Promise((resolve) => {
      const id = `f${nextFileId++}`
      const reader = new FileReader()
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer
        let category = detectCategory(file.name)
        const dateWasGuessed = parseFilenameMeta(file.name) === null

        // Parsed once up front: feeds column-based category detection below
        // (for 'base'/unknown filenames) and the generic per-row validator
        // for every "new" category, which has no in-browser transform of its
        // own (see validateGenericCategoryFile's doc comment).
        let rows: Record<string, unknown>[] = []
        try {
          const wb = XLSX.read(buffer)
          const ws = wb.Sheets[wb.SheetNames?.[0]]
          if (ws) {
            rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
          }
        } catch {
          // Silently ignore; category stays filename-detected, validation
          // below degrades gracefully to a "no rows" error for this file.
        }

        // Try column-based detection if filename suggests 'base'
        // to catch mislabeled files (e.g., _235 suffix with 'all' columns)
        if ((category === 'base' || category === null) && rows.length > 0) {
          const detectedByColumns = detectCategoryByColumns(rows[0])
          if (detectedByColumns) {
            category = detectedByColumns
          }
        }

        let previewSnapshot: Snapshot | undefined
        let previewError: string | undefined
        let validation: ValidationReport | undefined
        if (category === 'base') {
          try {
            previewSnapshot = parseHippoExcelFile(buffer, file.name)
            validation = validateSnapshot(previewSnapshot)
          } catch (err) {
            previewError =
              err instanceof ParseHippoExcelError
                ? err.message
                : err instanceof Error
                  ? `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`
                  : 'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างอ่านไฟล์'
          }
        } else if (category !== null) {
          validation = validateGenericCategoryFile(rows)
        }

        resolve({
          id,
          filename: file.name,
          category,
          buffer,
          previewSnapshot,
          previewError,
          validation,
          dateWasGuessed,
          // Critical validation errors block save-by-default too — user can still
          // inspect the row, but must fix the file rather than ship bad data.
          selected: category !== null && (validation?.ok ?? true),
          saveState: { status: 'idle' },
        })
      }
      reader.onerror = () => {
        resolve({
          id,
          filename: file.name,
          category: null,
          buffer: new ArrayBuffer(0),
          previewError: 'ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง',
          dateWasGuessed: false,
          selected: false,
          saveState: { status: 'idle' },
        })
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFiles = async (fileList: FileList) => {
    setBatchSummary(null)
    const newEntries = await Promise.all(Array.from(fileList).map(readFileAsEntry))

    // Check for duplicates
    const duplicates = newEntries.filter((entry) => hasDuplicateFilename(entry.filename))
    if (duplicates.length > 0) {
      const dupNames = duplicates.map((d) => d.filename).join(', ')
      setBatchSummary(`⚠️ ไฟล์ซ้ำ: ${dupNames} — จะไม่เพิ่มไฟล์เหล่านี้`)
      // Only add non-duplicate files
      const nonDuplicates = newEntries.filter((entry) => !hasDuplicateFilename(entry.filename))
      setFiles((prev) => [...prev, ...nonDuplicates])
    } else {
      setFiles((prev) => [...prev, ...newEntries])
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
  }

  const reset = () => {
    if (files.length === 0) return
    if (!confirm(`ต้องการล้างข้อมูลนำเข้า ${files.length} ไฟล์ หรือไม่?\n\n⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return
    }
    setFiles([])
    setBatchSummary(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const toggleSelected = (id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id && f.category !== null && (f.validation?.ok ?? true) ? { ...f, selected: !f.selected } : f,
      ),
    )
  }

  const hasDuplicateFilename = (filename: string): boolean => {
    return files.some((f) => f.filename === filename)
  }

  const updateFileSaveState = (id: string, saveState: FileSaveState) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, saveState } : f)))
  }

  const saveOneFile = async (entry: SelectedFile): Promise<boolean> => {
    updateFileSaveState(entry.id, { status: 'saving' })
    try {
      const contentBase64 = arrayBufferToBase64(entry.buffer)
      const response = await fetch(SAVE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': APP_SHARED_KEY,
        },
        body: JSON.stringify({ filename: entry.filename, contentBase64 }),
      })

      const body = (await response.json().catch(() => ({}))) as SaveSnapshotResponseBody

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `บันทึกไม่สำเร็จ (HTTP ${response.status})`)
      }

      updateFileSaveState(entry.id, {
        status: 'success',
        actionsUrl: body.actionsUrl ?? DEFAULT_ACTIONS_URL,
      })
      return true
    } catch (err) {
      updateFileSaveState(entry.id, {
        status: 'error',
        message: `บันทึกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`,
      })
      return false
    }
  }

  const saveSelectedToGitHub = async () => {
    if (!SAVE_WORKER_URL) return
    const targets = files.filter((f) => f.selected)
    if (targets.length === 0) return

    setIsSavingBatch(true)
    setBatchSummary(null)

    let successCount = 0
    for (const entry of targets) {
      // Sequential on purpose: avoid hammering the Worker/GitHub API with a
      // burst of concurrent commits, and let the UI show live progress
      // through the list rather than a single frozen button.
      const ok = await saveOneFile(entry)
      if (ok) successCount += 1
    }

    setIsSavingBatch(false)
    setBatchSummary(`บันทึกสำเร็จ ${successCount} จาก ${targets.length} ไฟล์`)
  }

  const selectedCount = files.filter((f) => f.selected).length
  const anySaveSucceeded = files.some((f) => f.saveState.status === 'success')
  const lastSuccessActionsUrl =
    [...files].reverse().find((f) => f.saveState.status === 'success')?.saveState as
      | { status: 'success'; actionsUrl: string }
      | undefined

  const baseFilesWithPreview = files.filter((f) => f.selected && f.previewSnapshot)
  const singlePreview = baseFilesWithPreview.length === 1 ? baseFilesWithPreview[0] : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm leading-relaxed text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <p className="font-medium">ℹ️ หมายเหตุ</p>
        <div className="mt-2 space-y-2 text-slate-700 dark:text-slate-300">
          <p>
            ข้อมูลที่อัปโหลดจะแสดงผลเฉพาะในเบราว์เซอร์ของท่าน{' '}
            <span className="font-semibold">ไม่ถูกบันทึก</span> และจะหายไปเมื่อรีเฟรช
          </p>
          <p>
            หากต้องการให้ข้อมูลแสดงผลแบบถาวร สามารถบันทึกไปยัง GitHub ได้ (ไม่ต้องใช้ token) ระบบจะนำไฟล์ไปวางไว้ที่{' '}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40 dark:text-amber-300">data/raw/</code>
          </p>
          <p>
            <strong>สำคัญ:</strong> ตรวจสอบไฟล์ให้แน่ใจว่ามีคอลัมน์ที่ถูกต้อง (hospcode, hospname, OP68, Telemed69 ฯลฯ) ก่อนบันทึก
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-3 py-6 sm:px-5 sm:py-8 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <p className="mb-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          เลือกไฟล์ Excel (.xlsx) ที่ส่งออกจาก Hippo ได้ครั้งละหลายไฟล์ เพื่อดูตัวอย่างหรือบันทึกพร้อมกัน หรือลากไฟล์มาวางที่นี่
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          onChange={onInputChange}
          className="mx-auto block w-full px-2 text-xs sm:text-sm text-slate-600 file:mr-2 sm:file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-2 sm:file:px-4 file:py-1.5 sm:file:py-2 file:text-xs sm:file:text-sm file:font-medium file:text-white file:shadow-sm hover:file:bg-brand-700 dark:text-slate-300"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              เลือกไว้ <span className="font-medium text-slate-800 dark:text-slate-100">{files.length}</span> | บันทึก <span className="font-medium text-slate-800 dark:text-slate-100">{selectedCount}</span>
            </p>
            <button
              type="button"
              onClick={reset}
              className="sm:ml-auto rounded-lg border border-rose-300 bg-rose-50 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-100 transition w-full sm:w-auto dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
              title={`ล้างข้อมูลนำเข้า ${files.length} ไฟล์ — จำเป็นต้องยืนยัน`}
            >
              🗑️ ล้างข้อมูล
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap">เลือก</th>
                  <th className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">ไฟล์</th>
                  <th className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap">ประเภท</th>
                  <th className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap">ตรวจสอบข้อมูล</th>
                  <th className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {files.map((f) => {
                  const isUnknown = f.category === null
                  const hasValidationErrors = f.validation && !f.validation.ok
                  const hasValidationWarnings = f.validation && f.validation.ok && f.validation.warnings.length > 0
                  const rowHighlightClass = isUnknown || hasValidationErrors
                    ? 'bg-rose-50 dark:bg-rose-950/30'
                    : hasValidationWarnings
                      ? 'bg-amber-50 dark:bg-amber-950/20'
                      : undefined
                  return (
                    <tr key={f.id} className={rowHighlightClass}>
                      <td className="px-2 sm:px-4 py-2">
                        <input
                          type="checkbox"
                          checked={f.selected}
                          disabled={isUnknown || hasValidationErrors}
                          onChange={() => toggleSelected(f.id)}
                          title={hasValidationErrors ? 'ไม่สามารถบันทึกได้ — มีข้อผิดพลาดร้ายแรง กรุณาแก้ไขไฟล์ก่อน' : undefined}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                        />
                      </td>
                      <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm max-w-xs ${isUnknown ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        <span className="truncate block">{f.filename}</span>
                        {f.previewError && (
                          <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">{f.previewError}</p>
                        )}
                      </td>
                      <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap ${isUnknown ? 'font-medium text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}>
                        {categoryLabel(f.category)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                        <ValidationBadge validation={f.validation} />
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                        {f.saveState.status === 'idle' && <span className="text-slate-400 dark:text-slate-500">—</span>}
                        {f.saveState.status === 'saving' && (
                          <span className="text-slate-500 text-xs dark:text-slate-400">บันทึก...</span>
                        )}
                        {f.saveState.status === 'success' && (
                          <span className="text-emerald-700 dark:text-emerald-400">✓</span>
                        )}
                        {f.saveState.status === 'error' && (
                          <span className="text-rose-700 text-xs dark:text-rose-400">ผิดพลาด</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {files.some((f) => f.validation) && (
            <div className="flex flex-col gap-3">
              {files
                .filter((f) => f.validation && (!f.validation.ok || f.validation.warnings.length > 0))
                .map((f) => (
                  <ValidationReportCard key={f.id} filename={f.filename} validation={f.validation as ValidationReport} />
                ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 sm:px-5 sm:py-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
            <div>
              <p className="font-medium text-emerald-900 text-xs sm:text-sm dark:text-emerald-300">บันทึกไปยัง GitHub (ผู้ดูแลระบบ)</p>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                ส่งไฟล์ไปบันทึกที่ <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/40 dark:text-emerald-300">data/raw/</code> โดยอัตโนมัติ — ไม่ต้องใช้ token
              </p>
            </div>

            {isUnlocked ? (
              <div>
                <button
                  type="button"
                  onClick={saveSelectedToGitHub}
                  disabled={!SAVE_WORKER_URL || selectedCount === 0 || isSavingBatch}
                  className="w-full rounded-lg bg-emerald-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition dark:disabled:bg-slate-700"
                >
                  {isSavingBatch ? 'กำลังบันทึก...' : 'บันทึกไปยัง GitHub'}
                </button>
                {!SAVE_WORKER_URL && (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                    ยังไม่ได้ตั้งค่าระบบบันทึกถาวร
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">รหัสผู้ดูแลระบบ</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value)
                        setPinError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUnlock()
                      }}
                      placeholder="กรอกรหัส"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleUnlock}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition w-full sm:w-auto dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                    >
                      ปลดล็อก
                    </button>
                  </div>
                </div>
                {pinError && <p className="text-xs text-rose-600 dark:text-rose-400">{pinError}</p>}
              </div>
            )}

            {batchSummary && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs sm:text-sm text-emerald-800 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                {batchSummary}
              </div>
            )}

            {anySaveSucceeded && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs sm:text-sm text-emerald-800 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                <p className="mb-1">บันทึกสำเร็จ ✓</p>
                <p className="text-xs mb-2">GitHub Actions จะ build โดยอัตโนมัติ สามารถติดตามที่:</p>
                <a
                  href={
                    lastSuccessActionsUrl?.status === 'success' ? lastSuccessActionsUrl.actionsUrl : DEFAULT_ACTIONS_URL
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-700 underline hover:text-brand-800 text-xs sm:text-sm break-all dark:text-brand-400 dark:hover:text-brand-300"
                >
                  GitHub Actions
                </a>
              </div>
            )}
          </div>

          {singlePreview && singlePreview.previewSnapshot && (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 sm:px-5 sm:py-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/30">
                <p className="text-xs sm:text-sm text-blue-900 dark:text-blue-300">
                  <span className="font-semibold">ตัวอย่าง:</span> {singlePreview.filename}
                  {' — '}
                  {singlePreview.dateWasGuessed ? (
                    <>
                      ไม่พบวันที่ ({formatThaiDate(singlePreview.previewSnapshot.snapshotDate)})
                    </>
                  ) : (
                    <>{formatThaiDate(singlePreview.previewSnapshot.snapshotDate)}</>
                  )}
                </p>
                {singlePreview.validation && (
                  <p className="mt-1 text-xs sm:text-sm text-blue-900 dark:text-blue-300">
                    <span className="font-semibold">คุณภาพข้อมูล:</span>{' '}
                    {singlePreview.validation.stats.completenessPercent}% ครบถ้วน, {singlePreview.validation.stats.rowCount} แถว
                    {singlePreview.validation.stats.dateRange && (
                      <> (ปีงบ {singlePreview.validation.stats.dateRange.earliest}–{singlePreview.validation.stats.dateRange.latest})</>
                    )}
                  </p>
                )}
              </div>
              <SnapshotView snapshot={singlePreview.previewSnapshot} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Compact per-file status chip shown in the file list table's "ตรวจสอบข้อมูล" column. */
function ValidationBadge({ validation }: { validation?: ValidationReport }) {
  if (!validation) return <span className="text-slate-400 dark:text-slate-500">—</span>
  if (!validation.ok) {
    return (
      <span className="font-medium text-rose-700 dark:text-rose-300">
        ❌ {validation.errors.length} ข้อผิดพลาด
      </span>
    )
  }
  if (validation.warnings.length > 0) {
    return (
      <span className="font-medium text-amber-700 dark:text-amber-400">
        ⚠️ {validation.warnings.length} คำเตือน
      </span>
    )
  }
  return <span className="font-medium text-emerald-700 dark:text-emerald-400">✅ ผ่าน</span>
}

/** Full validation report card — lists every error/warning plus the completeness/date-range/row-count stats. Only rendered for files that have at least one issue (errors or warnings); clean files just show the ✅ badge above. */
function ValidationReportCard({ filename, validation }: { filename: string; validation: ValidationReport }) {
  const { stats } = validation
  const borderColor = !validation.ok
    ? 'border-rose-300 dark:border-rose-800'
    : 'border-amber-300 dark:border-amber-800'
  const bgColor = !validation.ok ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-amber-50 dark:bg-amber-950/30'

  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} px-3 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm shadow-sm`}>
      <p className="font-medium text-slate-800 dark:text-slate-100">
        {!validation.ok ? '❌' : '⚠️'} ผลตรวจสอบข้อมูล: {filename}
      </p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        {stats.rowCount} แถว · ครบถ้วน {stats.completenessPercent}%
        {stats.dateRange && <> · ปีงบ {stats.dateRange.earliest}–{stats.dateRange.latest}</>}
      </p>

      {stats.missingColumns.length > 0 && (
        <p className="mt-1 text-rose-700 dark:text-rose-300">
          คอลัมน์ที่ขาดไป: {stats.missingColumns.join(', ')}
        </p>
      )}

      {validation.errors.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-rose-700 dark:text-rose-300">ข้อผิดพลาด (ต้องแก้ก่อนบันทึก):</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-rose-700 dark:text-rose-300">
            {validation.errors.map((e) => (
              <li key={e.code}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-amber-700 dark:text-amber-400">คำเตือน (บันทึกได้ แต่ควรตรวจสอบ):</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-700 dark:text-amber-400">
            {validation.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ImportExcelTab
