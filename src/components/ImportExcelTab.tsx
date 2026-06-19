import { useRef, useState } from 'react'
import type { Snapshot } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { ParseHippoExcelError, parseFilenameMeta, parseHippoExcelFile } from '../lib/parseHippoExcel'
import SnapshotView from './SnapshotView'

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing'; filename: string }
  | { status: 'error'; filename: string; message: string }
  | {
      status: 'ready'
      filename: string
      snapshot: Snapshot
      dateWasGuessed: boolean
      /** Raw bytes of the originally-uploaded file, kept so the GitHub publish
       * flow can base64-encode and commit the exact same bytes without
       * re-reading the File a second time. */
      buffer: ArrayBuffer
    }

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; actionsUrl: string }
  | { status: 'error'; message: string }

const GITHUB_OWNER = 'thering999'
const GITHUB_REPO = 'telemedmuk'

const SAVE_WORKER_URL = import.meta.env.VITE_SAVE_WORKER_URL ?? ''
const APP_SHARED_KEY = import.meta.env.VITE_APP_SHARED_KEY ?? ''

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

function ImportExcelTab() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setState({ status: 'parsing', filename: file.name })
    setSaveState({ status: 'idle' })
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer
        const snapshot = parseHippoExcelFile(buffer, file.name)
        const dateWasGuessed = parseFilenameMeta(file.name) === null
        setState({ status: 'ready', filename: file.name, snapshot, dateWasGuessed, buffer })
      } catch (err) {
        setState({
          status: 'error',
          filename: file.name,
          message:
            err instanceof ParseHippoExcelError
              ? err.message
              : err instanceof Error
                ? `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`
                : 'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างอ่านไฟล์',
        })
      }
    }
    reader.onerror = () => {
      setState({
        status: 'error',
        filename: file.name,
        message: 'ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง',
      })
    }
    reader.readAsArrayBuffer(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setState({ status: 'idle' })
    setSaveState({ status: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const saveToGitHub = async () => {
    if (state.status !== 'ready' || !SAVE_WORKER_URL) return
    setSaveState({ status: 'saving' })
    const { filename, buffer } = state

    try {
      const contentBase64 = arrayBufferToBase64(buffer)
      const response = await fetch(SAVE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': APP_SHARED_KEY,
        },
        body: JSON.stringify({ filename, contentBase64 }),
      })

      const body = (await response.json().catch(() => ({}))) as SaveSnapshotResponseBody

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `บันทึกไม่สำเร็จ (HTTP ${response.status})`)
      }

      setSaveState({
        status: 'success',
        actionsUrl: body.actionsUrl ?? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`,
      })
    } catch (err) {
      setSaveState({
        status: 'error',
        message: `บันทึกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900 shadow-sm">
        <p className="font-medium">หมายเหตุสำคัญ</p>
        <p className="mt-1 text-slate-700">
          ข้อมูลที่อัปโหลดในแท็บนี้จะแสดงผลเฉพาะในเบราว์เซอร์ของท่านเท่านั้น{' '}
          <span className="font-semibold">ไม่ถูกบันทึกไว้ที่ใด</span> และจะหายไปเมื่อรีเฟรชหน้านี้
          หากต้องการให้ข้อมูลนี้แสดงผลแบบถาวรสำหรับผู้เข้าชมทุกคนบนเว็บไซต์จริง สามารถกดปุ่ม
          "บันทึกไฟล์นี้ไปยัง GitHub แบบถาวร" ด้านล่างได้เลยหลังนำเข้าไฟล์สำเร็จ (ไม่ต้องใช้ token หรือความรู้ทางเทคนิคใด ๆ)
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
          เลือกไฟล์ Excel (.xlsx) ที่ส่งออกจาก Hippo เพื่อดูรายงานแบบเฉพาะกิจ หรือลากไฟล์มาวางที่นี่
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={onInputChange}
          className="mx-auto block w-full max-w-sm text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:shadow-sm hover:file:bg-brand-700"
        />
      </div>

      {state.status === 'parsing' && (
        <p className="text-center text-slate-500">กำลังอ่านไฟล์ {state.filename}...</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          <p className="font-medium">ไม่สามารถนำเข้าไฟล์ "{state.filename}" ได้</p>
          <p className="mt-1 text-sm">{state.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            ลองไฟล์อื่น
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-slate-600">
              ข้อมูลจากไฟล์ที่อัปโหลด: <span className="font-medium text-slate-800">{state.filename}</span>
              {' — '}
              {state.dateWasGuessed ? (
                <>
                  ไม่พบรูปแบบวันที่ในชื่อไฟล์ จึงใช้วันที่ปัจจุบันแทน (
                  {formatThaiDate(state.snapshot.snapshotDate)})
                </>
              ) : (
                <>ข้อมูล ณ {formatThaiDate(state.snapshot.snapshotDate)}</>
              )}
            </p>
            <button
              type="button"
              onClick={reset}
              className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              นำเข้าไฟล์ใหม่
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div>
              <p className="font-medium text-emerald-900">บันทึกไฟล์นี้ไปยัง GitHub แบบถาวร (สำหรับผู้ดูแลระบบ)</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                กดปุ่มด้านล่างเพื่อส่งไฟล์นี้ไปบันทึกไว้ที่ <code className="rounded bg-emerald-100 px-1">data/raw/</code>{' '}
                บน branch <code className="rounded bg-emerald-100 px-1">main</code> ของ repository{' '}
                <code className="rounded bg-emerald-100 px-1">thering999/telemedmuk</code> โดยอัตโนมัติ —
                ไม่ต้องใช้ token หรือความรู้ด้าน GitHub ใด ๆ ระบบจะไปกระตุ้น GitHub Actions ที่มีอยู่แล้วให้ประมวลผลและเผยแพร่ข้อมูลให้เอง
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={saveToGitHub}
                disabled={!SAVE_WORKER_URL || saveState.status === 'saving'}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saveState.status === 'saving' ? 'กำลังบันทึก...' : 'บันทึกไฟล์นี้ไปยัง GitHub แบบถาวร'}
              </button>
              {!SAVE_WORKER_URL && (
                <p className="mt-2 text-xs text-rose-600">
                  ยังไม่ได้ตั้งค่าระบบบันทึกถาวร (ติดต่อผู้ดูแลระบบ)
                </p>
              )}
            </div>

            {saveState.status === 'success' && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800">
                บันทึกไฟล์ขึ้น branch <code className="rounded bg-emerald-100 px-1">main</code> สำเร็จแล้ว
                ระบบ GitHub Actions จะ build และเผยแพร่เว็บไซต์เวอร์ชันใหม่โดยอัตโนมัติภายในไม่กี่นาที สามารถติดตามสถานะได้ที่{' '}
                <a
                  href={saveState.actionsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-700 underline hover:text-brand-800"
                >
                  GitHub Actions
                </a>
              </div>
            )}

            {saveState.status === 'error' && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveState.message}
              </div>
            )}
          </div>

          <SnapshotView snapshot={state.snapshot} />
        </>
      )}
    </div>
  )
}

export default ImportExcelTab
