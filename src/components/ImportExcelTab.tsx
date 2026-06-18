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
  | { status: 'success'; commitUrl: string }
  | { status: 'error'; message: string }

const GITHUB_OWNER = 'thering999'
const GITHUB_REPO = 'telemedmuk'
const GITHUB_BRANCH = 'main'
const TOKEN_STORAGE_KEY = 'telemedmuk.githubPat'

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

interface GitHubContentsErrorBody {
  message?: string
}

interface GitHubContentsGetResponse {
  sha?: string
}

class GitHubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function ImportExcelTab() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const onTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setToken(value)
    if (value) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, value)
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }

  const clearToken = () => {
    setToken('')
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }

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
    if (state.status !== 'ready' || !token) return
    setSaveState({ status: 'saving' })
    const { filename, buffer } = state
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/raw/${encodeURIComponent(filename)}`
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    }

    try {
      // Step 1: check whether the file already exists on `main` to obtain its
      // current sha (required by the GitHub API to update an existing file).
      // A 404 here is the expected/normal case for a brand-new file.
      let existingSha: string | undefined
      const getResponse = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers })
      if (getResponse.ok) {
        const body = (await getResponse.json()) as GitHubContentsGetResponse
        existingSha = body.sha
      } else if (getResponse.status !== 404) {
        const errorBody = (await getResponse.json().catch(() => ({}))) as GitHubContentsErrorBody
        throw new GitHubApiError(getResponse.status, errorBody.message ?? getResponse.statusText)
      }

      // Step 2: base64-encode the original uploaded bytes (no re-read of File).
      const base64Content = arrayBufferToBase64(buffer)

      // Step 3: create or update the file on `main` via the Contents API.
      const putResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Add Hippo export ${filename} via dashboard import tab`,
          content: base64Content,
          branch: GITHUB_BRANCH,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      })

      if (!putResponse.ok) {
        const errorBody = (await putResponse.json().catch(() => ({}))) as GitHubContentsErrorBody
        throw new GitHubApiError(putResponse.status, errorBody.message ?? putResponse.statusText)
      }

      setSaveState({
        status: 'success',
        commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`,
      })
    } catch (err) {
      if (err instanceof GitHubApiError) {
        const prefix =
          err.status === 401 || err.status === 403
            ? `บันทึกไม่สำเร็จ: token ไม่ถูกต้องหรือไม่มีสิทธิ์เขียนไฟล์ (HTTP ${err.status})`
            : `บันทึกไม่สำเร็จ (HTTP ${err.status})`
        setSaveState({ status: 'error', message: `${prefix} — ${err.message}` })
      } else {
        setSaveState({
          status: 'error',
          message: `บันทึกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }
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

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div>
              <p className="font-medium text-emerald-900">บันทึกไฟล์นี้ไปยัง GitHub แบบถาวร (สำหรับผู้ดูแลระบบ)</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                ฟีเจอร์นี้จะเรียก GitHub API จากเบราว์เซอร์ของท่านโดยตรง เพื่อนำไฟล์นี้ไปวางไว้ที่{' '}
                <code className="rounded bg-emerald-100 px-1">data/raw/</code> บน branch{' '}
                <code className="rounded bg-emerald-100 px-1">main</code> ของ repository{' '}
                <code className="rounded bg-emerald-100 px-1">thering999/telemedmuk</code> ซึ่งจะไปกระตุ้นระบบ
                GitHub Actions ที่มีอยู่แล้วให้ประมวลผลและเผยแพร่ข้อมูลอัตโนมัติ
              </p>
            </div>

            <div>
              <label htmlFor="github-pat" className="block text-sm font-medium text-slate-700">
                GitHub Personal Access Token
              </label>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                ต้องเป็น token ที่มีสิทธิ์เขียนไฟล์ใน repository{' '}
                <code className="rounded bg-emerald-100 px-1">thering999/telemedmuk</code> — แนะนำให้สร้าง
                fine-grained PAT ที่จำกัดสิทธิ์เฉพาะ repository นี้เท่านั้น โดยให้สิทธิ์ "Contents: Read and write"
                หรือใช้ classic PAT ที่มี scope <code className="rounded bg-emerald-100 px-1">repo</code> แทนได้
                เช่นกัน
              </p>
              <input
                id="github-pat"
                type="password"
                value={token}
                onChange={onTokenChange}
                placeholder="ghp_... หรือ github_pat_..."
                autoComplete="off"
                className="mt-2 block w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                <span className="font-semibold">ข้อควรระวังด้านความปลอดภัย:</span> token นี้ถูกใช้เพื่อเรียก GitHub
                API จากเบราว์เซอร์ของท่านเองเท่านั้น และถูกเก็บไว้ใน{' '}
                <code className="rounded bg-emerald-200 px-1">sessionStorage</code> ของเบราว์เซอร์ (จะถูกล้างทันทีที่ปิดแท็บนี้)
                — <span className="font-semibold">ไม่เก็บลง localStorage ไม่ถูกส่งไปที่ใดนอกจาก api.github.com
                และไม่ถูกเขียนลงในเว็บไซต์หรือ repository แต่อย่างใด</span> หากใช้งานบนเครื่องคอมพิวเตอร์สาธารณะหรือเครื่องที่ใช้ร่วมกับผู้อื่น
                กรุณา revoke token นี้บน GitHub หลังใช้งานเสร็จทุกครั้ง
              </p>
              <button
                type="button"
                onClick={clearToken}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                ล้าง token
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={saveToGitHub}
                disabled={!token || saveState.status === 'saving'}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saveState.status === 'saving'
                  ? 'กำลังบันทึก...'
                  : 'บันทึกไฟล์นี้ไปยัง data/raw/ บน GitHub (ถาวร)'}
              </button>
            </div>

            {saveState.status === 'success' && (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800">
                บันทึกไฟล์ขึ้น branch <code className="rounded bg-emerald-100 px-1">main</code> สำเร็จแล้ว
                ระบบ GitHub Actions จะ build และเผยแพร่เว็บไซต์เวอร์ชันใหม่โดยอัตโนมัติภายในไม่กี่นาที สามารถติดตามสถานะได้ที่{' '}
                <a
                  href={saveState.commitUrl}
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
