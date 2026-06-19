import { useRef, useState } from 'react'
import type { ReportCategory, Snapshot } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { ParseHippoExcelError, detectCategory, parseFilenameMeta, parseHippoExcelFile } from '../lib/parseHippoExcel'
import SnapshotView from './SnapshotView'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const readFileAsEntry = (file: File): Promise<SelectedFile> => {
    return new Promise((resolve) => {
      const id = `f${nextFileId++}`
      const reader = new FileReader()
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer
        const category = detectCategory(file.name)
        const dateWasGuessed = parseFilenameMeta(file.name) === null

        let previewSnapshot: Snapshot | undefined
        let previewError: string | undefined
        if (category === 'base') {
          try {
            previewSnapshot = parseHippoExcelFile(buffer, file.name)
          } catch (err) {
            previewError =
              err instanceof ParseHippoExcelError
                ? err.message
                : err instanceof Error
                  ? `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`
                  : 'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างอ่านไฟล์'
          }
        }

        resolve({
          id,
          filename: file.name,
          category,
          buffer,
          previewSnapshot,
          previewError,
          dateWasGuessed,
          selected: category !== null,
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
    setFiles((prev) => [...prev, ...newEntries])
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
  }

  const reset = () => {
    setFiles([])
    setBatchSummary(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const toggleSelected = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id && f.category !== null ? { ...f, selected: !f.selected } : f)),
    )
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900 shadow-sm">
        <p className="font-medium">หมายเหตุสำคัญ</p>
        <p className="mt-1 text-slate-700">
          ข้อมูลที่อัปโหลดในแท็บนี้จะแสดงผลเฉพาะในเบราว์เซอร์ของท่านเท่านั้น{' '}
          <span className="font-semibold">ไม่ถูกบันทึกไว้ที่ใด</span> และจะหายไปเมื่อรีเฟรชหน้านี้
          หากต้องการให้ข้อมูลนี้แสดงผลแบบถาวรสำหรับผู้เข้าชมทุกคนบนเว็บไซต์จริง สามารถกดปุ่ม
          "บันทึกไฟล์ที่เลือกทั้งหมดไปยัง GitHub แบบถาวร" ด้านล่างได้เลยหลังนำเข้าไฟล์สำเร็จ (ไม่ต้องใช้ token หรือความรู้ทางเทคนิคใด ๆ)
          ระบบจะนำไฟล์ไปวางไว้ที่ <code className="rounded bg-amber-100 px-1">data/raw/</code> บน branch{' '}
          <code className="rounded bg-amber-100 px-1">main</code> ของโปรเจกต์ให้อัตโนมัติ แล้วให้ระบบอัตโนมัติ
          (GitHub Actions) ประมวลผลและเผยแพร่ข้อมูลต่อเอง — นี่คือวิธีบันทึกข้อมูลแบบถาวรบนเว็บไซต์แบบ static นี้
          ส่วนแท็บนี้เองมีไว้สำหรับดูข้อมูลแบบเฉพาะกิจ (ad hoc) อย่างรวดเร็วเท่านั้น
        </p>
      </div>

      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-8 text-center shadow-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <p className="mb-3 text-sm text-slate-600">
          เลือกไฟล์ Excel (.xlsx) ที่ส่งออกจาก Hippo ได้ครั้งละหลายไฟล์ เพื่อดูตัวอย่างหรือบันทึกพร้อมกัน หรือลากไฟล์มาวางที่นี่
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          onChange={onInputChange}
          className="mx-auto block w-full max-w-sm text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:shadow-sm hover:file:bg-brand-700"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-slate-600">
              เลือกไฟล์ไว้ <span className="font-medium text-slate-800">{files.length}</span> ไฟล์
              {' — '}
              พร้อมบันทึก <span className="font-medium text-slate-800">{selectedCount}</span> ไฟล์
            </p>
            <button
              type="button"
              onClick={reset}
              className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              นำเข้าไฟล์ใหม่
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">เลือก</th>
                  <th className="px-4 py-2 font-medium">ไฟล์</th>
                  <th className="px-4 py-2 font-medium">ประเภทรายงาน</th>
                  <th className="px-4 py-2 font-medium">สถานะการบันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((f) => {
                  const isUnknown = f.category === null
                  return (
                    <tr key={f.id} className={isUnknown ? 'bg-rose-50' : undefined}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={f.selected}
                          disabled={isUnknown}
                          onChange={() => toggleSelected(f.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </td>
                      <td className={`px-4 py-2 ${isUnknown ? 'text-rose-700' : 'text-slate-700'}`}>
                        {f.filename}
                        {f.previewError && (
                          <p className="mt-0.5 text-xs text-rose-600">{f.previewError}</p>
                        )}
                      </td>
                      <td className={isUnknown ? 'px-4 py-2 font-medium text-rose-700' : 'px-4 py-2 text-slate-600'}>
                        {categoryLabel(f.category)}
                      </td>
                      <td className="px-4 py-2">
                        {f.saveState.status === 'idle' && <span className="text-slate-400">—</span>}
                        {f.saveState.status === 'saving' && (
                          <span className="text-slate-500">กำลังบันทึก...</span>
                        )}
                        {f.saveState.status === 'success' && (
                          <span className="text-emerald-700">บันทึกสำเร็จ ✓</span>
                        )}
                        {f.saveState.status === 'error' && (
                          <span className="text-rose-700">{f.saveState.message}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div>
              <p className="font-medium text-emerald-900">บันทึกไฟล์ที่เลือกไปยัง GitHub แบบถาวร (สำหรับผู้ดูแลระบบ)</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                กดปุ่มด้านล่างเพื่อส่งไฟล์ที่เลือกไว้ไปบันทึกที่ <code className="rounded bg-emerald-100 px-1">data/raw/</code>{' '}
                บน branch <code className="rounded bg-emerald-100 px-1">main</code> ของ repository{' '}
                <code className="rounded bg-emerald-100 px-1">thering999/telemedmuk</code> โดยอัตโนมัติ —
                ไม่ต้องใช้ token หรือความรู้ด้าน GitHub ใด ๆ ระบบจะไปกระตุ้น GitHub Actions ที่มีอยู่แล้วให้ประมวลผลและเผยแพร่ข้อมูลให้เอง
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={saveSelectedToGitHub}
                disabled={!SAVE_WORKER_URL || selectedCount === 0 || isSavingBatch}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSavingBatch ? 'กำลังบันทึก...' : 'บันทึกไฟล์ที่เลือกทั้งหมดไปยัง GitHub แบบถาวร'}
              </button>
              {!SAVE_WORKER_URL && (
                <p className="mt-2 text-xs text-rose-600">
                  ยังไม่ได้ตั้งค่าระบบบันทึกถาวร (ติดต่อผู้ดูแลระบบ)
                </p>
              )}
            </div>

            {batchSummary && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800">
                {batchSummary}
              </div>
            )}

            {anySaveSucceeded && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800">
                บันทึกไฟล์ขึ้น branch <code className="rounded bg-emerald-100 px-1">main</code> สำเร็จแล้ว
                ระบบ GitHub Actions จะ build และเผยแพร่เว็บไซต์เวอร์ชันใหม่โดยอัตโนมัติภายในไม่กี่นาที สามารถติดตามสถานะได้ที่{' '}
                <a
                  href={
                    lastSuccessActionsUrl?.status === 'success' ? lastSuccessActionsUrl.actionsUrl : DEFAULT_ACTIONS_URL
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-700 underline hover:text-brand-800"
                >
                  GitHub Actions
                </a>
              </div>
            )}
          </div>

          {singlePreview && singlePreview.previewSnapshot && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <p className="text-sm text-slate-600">
                  ตัวอย่างข้อมูลจากไฟล์: <span className="font-medium text-slate-800">{singlePreview.filename}</span>
                  {' — '}
                  {singlePreview.dateWasGuessed ? (
                    <>
                      ไม่พบรูปแบบวันที่ในชื่อไฟล์ จึงใช้วันที่ปัจจุบันแทน (
                      {formatThaiDate(singlePreview.previewSnapshot.snapshotDate)})
                    </>
                  ) : (
                    <>ข้อมูล ณ {formatThaiDate(singlePreview.previewSnapshot.snapshotDate)}</>
                  )}
                </p>
              </div>
              <SnapshotView snapshot={singlePreview.previewSnapshot} />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default ImportExcelTab
