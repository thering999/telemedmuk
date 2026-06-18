import { useRef, useState } from 'react'
import type { Snapshot } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { ParseHippoExcelError, parseHippoExcelFile } from '../lib/parseHippoExcel'
import SnapshotView from './SnapshotView'

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing'; filename: string }
  | { status: 'error'; filename: string; message: string }
  | { status: 'ready'; filename: string; snapshot: Snapshot; dateWasGuessed: boolean }

function ImportExcelTab() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setState({ status: 'parsing', filename: file.name })
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer
        const snapshot = parseHippoExcelFile(buffer, file.name)
        const dateWasGuessed = !/^\d{8}_\d{2}_telemed_hosp_\d+\.xlsx$/i.test(file.name)
        setState({ status: 'ready', filename: file.name, snapshot, dateWasGuessed })
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
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900 shadow-sm">
        <p className="font-medium">หมายเหตุสำคัญ</p>
        <p className="mt-1 text-slate-700">
          ข้อมูลที่อัปโหลดในแท็บนี้จะแสดงผลเฉพาะในเบราว์เซอร์ของท่านเท่านั้น{' '}
          <span className="font-semibold">ไม่ถูกบันทึกไว้ที่ใด</span> และจะหายไปเมื่อรีเฟรชหน้านี้
          หากต้องการให้ข้อมูลนี้แสดงผลแบบถาวรสำหรับผู้เข้าชมทุกคนบนเว็บไซต์จริง
          กรุณานำไฟล์ไปวางไว้ที่ <code className="rounded bg-amber-100 px-1">data/raw/</code>{' '}
          ในโค้ดของโปรเจกต์ แล้ว push ขึ้น branch <code className="rounded bg-amber-100 px-1">main</code>{' '}
          เพื่อให้ระบบอัตโนมัติ (GitHub Actions) ประมวลผลและเผยแพร่ข้อมูลให้ — นี่คือวิธีบันทึกข้อมูลแบบถาวรบนเว็บไซต์
          แบบ static นี้ ส่วนแท็บนี้มีไว้สำหรับดูข้อมูลแบบเฉพาะกิจ (ad hoc) อย่างรวดเร็วเท่านั้น
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

          <SnapshotView snapshot={state.snapshot} />
        </>
      )}
    </div>
  )
}

export default ImportExcelTab
