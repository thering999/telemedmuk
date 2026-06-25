import { useState } from 'react'
import { ADMIN_PASSWORD } from '../lib/adminAuth'

const SAVE_WORKER_URL = import.meta.env.VITE_SAVE_WORKER_URL ?? ''
const APP_SHARED_KEY = import.meta.env.VITE_APP_SHARED_KEY ?? ''
const CLEAR_ALL_URL = SAVE_WORKER_URL.replace(/\/save-snapshot$/, '/clear-all')

interface AdminPanelProps {
  onClose?: () => void
}

function AdminPanel({ onClose }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [clearAllError, setClearAllError] = useState('')

  const handleLogin = () => {
    setError('')
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setPassword('')
    } else {
      setError('รหัสผ่านไม่ถูกต้อง')
    }
  }

  const handleClearCache = () => {
    // Clear local storage
    localStorage.clear()
    sessionStorage.clear()
    setSuccessMessage('ล้างข้อมูล cache สำเร็จ ⟲ Refresh หน้าเดี๋ยว')
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  }

  const handleClearImportHistory = () => {
    const keysToDelete = []
    // Get all keys before clearing (since clearing changes iteration)
    const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean)

    // Find and delete import/file related keys
    allKeys.forEach(key => {
      if (key && (key.includes('import') || key.includes('file') || key.includes('upload') || key.includes('hippo'))) {
        localStorage.removeItem(key)
        keysToDelete.push(key)
      }
    })

    // Also clear session storage
    sessionStorage.clear()

    setSuccessMessage(`ล้างประวัติการนำเข้า ${keysToDelete.length} รายการและ session storage สำเร็จ`)
  }

  const handleClearAllData = async () => {
    setClearAllError('')
    if (!CLEAR_ALL_URL) {
      setClearAllError('ยังไม่ได้ตั้งค่าระบบบันทึกถาวร (VITE_SAVE_WORKER_URL)')
      return
    }
    const confirmed = confirm(
      'ต้องการล้างข้อมูลทั้งหมดในระบบ (ไฟล์ใน data/raw และ snapshot ทุกวันที่) ใช่หรือไม่?\n\n⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้',
    )
    if (!confirmed) return

    setIsClearingAll(true)
    setSuccessMessage('')
    try {
      const response = await fetch(CLEAR_ALL_URL, {
        method: 'POST',
        headers: { 'X-App-Key': APP_SHARED_KEY },
      })
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        deletedCount?: number
      }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `ล้างข้อมูลไม่สำเร็จ (HTTP ${response.status})`)
      }
      setSuccessMessage(`ล้างข้อมูลทั้งหมดสำเร็จ (ลบ ${body.deletedCount ?? 0} ไฟล์) — รอ GitHub Actions build เสร็จแล้วรีเฟรชหน้า`)
    } catch (err) {
      setClearAllError(`ล้างข้อมูลไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsClearingAll(false)
    }
  }

  const handleExportDiagnostics = () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      storage: {
        localStorageSize: JSON.stringify(localStorage).length,
        sessionStorageSize: JSON.stringify(sessionStorage).length,
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
      },
      environment: {
        baseURL: import.meta.env.BASE_URL,
        mode: import.meta.env.MODE,
      },
    }

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagnostics-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSuccessMessage('ดาวน์โหลด diagnostics สำเร็จ')
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-8 shadow-2xl max-w-sm w-full dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 dark:text-slate-100">🔐 Admin Login</h2>
          <p className="text-sm text-slate-600 mb-4 dark:text-slate-300">ระบบจัดการสำหรับผู้ดูแลระบบ</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleLogin()
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Enter admin password"
            />
          </div>

          {error && <div className="text-sm text-rose-600 mb-4 dark:text-rose-400">❌ {error}</div>}

          <button
            onClick={handleLogin}
            className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 transition"
          >
            เข้าสู่ระบบ
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full mt-2 border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-100 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-2xl border border-slate-300 bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto dark:border-slate-700 dark:bg-slate-800">
        <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-brand-700 text-white p-4 sm:p-6 flex justify-between items-center">
          <h2 className="text-lg sm:text-2xl font-bold">⚙️ Admin Panel</h2>
          <button
            onClick={() => {
              setIsAuthenticated(false)
              onClose?.()
            }}
            className="text-white/80 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {successMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 sm:p-4 text-xs sm:text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✅ {successMessage}
            </div>
          )}

          <section>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 dark:text-slate-100">📊 ข้อมูลระบบ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="rounded-lg bg-slate-50 p-2 sm:p-3 dark:bg-slate-900">
                <p className="text-slate-600 text-xs dark:text-slate-400">เวลา:</p>
                <p className="font-mono text-slate-800 text-xs truncate dark:text-slate-200">{new Date().toLocaleString('th-TH')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 sm:p-3 dark:bg-slate-900">
                <p className="text-slate-600 text-xs dark:text-slate-400">Local Storage:</p>
                <p className="font-mono text-slate-800 text-xs dark:text-slate-200">{JSON.stringify(localStorage).length.toLocaleString('th-TH')} B</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 sm:p-3 dark:bg-slate-900">
                <p className="text-slate-600 text-xs dark:text-slate-400">Session Storage:</p>
                <p className="font-mono text-slate-800 text-xs dark:text-slate-200">{JSON.stringify(sessionStorage).length.toLocaleString('th-TH')} B</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 sm:p-3 dark:bg-slate-900">
                <p className="text-slate-600 text-xs dark:text-slate-400">Base URL:</p>
                <p className="font-mono text-slate-800 text-xs truncate dark:text-slate-200">{import.meta.env.BASE_URL || '/'}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 dark:text-slate-100">🗑️ จัดการข้อมูล</h3>
            <div className="space-y-3">
              <button
                onClick={handleClearImportHistory}
                className="w-full rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium border border-amber-300 transition dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700"
              >
                ล้างประวัติการนำเข้า
              </button>
              <p className="text-xs text-slate-600 dark:text-slate-400">ลบข้อมูล import ที่ค้างอยู่</p>

              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-2 sm:p-3 dark:bg-blue-950/30 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 mb-1 dark:text-blue-300">ℹ️ เกี่ยวกับข้อมูล</p>
                <p className="text-xs text-blue-800 leading-relaxed dark:text-blue-300">
                  Dashboard ใช้ <code className="bg-blue-100 px-1 rounded dark:bg-blue-900/50">Browser Cache</code> ไม่ใช่ localStorage
                </p>
              </div>

              <button
                onClick={handleClearAllData}
                disabled={isClearingAll}
                className="w-full mt-4 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300 text-white px-3 sm:px-4 py-2 sm:py-3 text-sm font-bold border border-rose-700 transition dark:disabled:bg-rose-900"
              >
                {isClearingAll ? 'กำลังล้างข้อมูล...' : '🔥 ล้างข้อมูลทั้งหมดในระบบ (ลบจาก GitHub)'}
              </button>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                ⚠️ ลบไฟล์ทั้งหมดใน <code className="bg-rose-100 px-1 rounded dark:bg-rose-900/50">data/raw/</code> และ snapshot ทุกวันที่ออกจาก GitHub repo จริง — ย้อนกลับไม่ได้
              </p>
              {clearAllError && (
                <p className="text-xs text-rose-700 dark:text-rose-400">❌ {clearAllError}</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 dark:text-slate-100">🔄 ตัวเลือกขั้นสูง</h3>
            <div className="space-y-3">
              <button
                onClick={handleExportDiagnostics}
                className="w-full rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium border border-blue-300 transition dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700"
              >
                📥 ดาวน์โหลด Diagnostics
              </button>
              <p className="text-xs text-slate-600 dark:text-slate-400">ส่งออกข้อมูลระบบ</p>

              <button
                onClick={handleClearCache}
                className="w-full rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium border border-rose-300 transition mt-3 sm:mt-4 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700"
              >
                ⚠️ ล้าง Session
              </button>
              <p className="text-xs text-rose-700 dark:text-rose-400">⚠️ ลบ localStorage/sessionStorage เท่านั้น</p>

              <div className="mt-3 sm:mt-4 rounded-lg bg-rose-50 border border-rose-200 p-2 sm:p-3 dark:bg-rose-950/30 dark:border-rose-800">
                <p className="text-xs font-semibold text-rose-900 mb-1 dark:text-rose-300">📱 ล้าง Browser Cache</p>
                <p className="text-xs text-rose-800 leading-relaxed dark:text-rose-300">
                  กด <strong>Ctrl+Shift+Del</strong> (Windows) หรือ <strong>Cmd+Shift+Del</strong> (Mac)
                </p>
              </div>
            </div>
          </section>

          <section className="bg-slate-50 rounded-lg p-2 sm:p-4 dark:bg-slate-900">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">📝 Keys</h3>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {Object.keys(localStorage).length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">ไม่มี keys</p>
              ) : (
                Object.keys(localStorage).map((key) => (
                  <p key={key} className="font-mono text-slate-600 break-all text-xs dark:text-slate-400">
                    • {key}
                  </p>
                ))
              )}
            </div>
          </section>

          <div className="border-t border-slate-200 pt-3 sm:pt-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            v1.0 | {new Date().toLocaleDateString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
