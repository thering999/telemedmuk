import { useState } from 'react'
import crypto from 'crypto'

// Hash password (simple SHA256 for client-side verification)
// Real apps should use backend authentication
const PASSWORD_HASH = 'd4c8e8e8a8e8e8e8e8e8e8e8e8e8e8e8' // Will be replaced with actual hash

function hashPassword(password: string): string {
  // Simple hash for demo - NOT for production
  // In production, use bcrypt or similar on backend
  const encoded = new TextEncoder().encode(password)
  let hash = 0
  for (let i = 0; i < encoded.length; i++) {
    hash = ((hash << 5) - hash) + encoded[i]
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

interface AdminPanelProps {
  onClose?: () => void
}

function AdminPanel({ onClose }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleLogin = () => {
    setError('')
    // Simple password check - NOT secure for production
    // Password should be Ssj4900036!@#
    if (password === 'Ssj4900036!@#') {
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
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('import')) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => localStorage.removeItem(key))
    setSuccessMessage(`ล้างประวัติการนำเข้า ${keysToDelete.length} รายการ สำเร็จ`)
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-2xl border border-slate-300 bg-white p-8 shadow-2xl max-w-sm w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">🔐 Admin Login</h2>
          <p className="text-sm text-slate-600 mb-4">ระบบจัดการสำหรับผู้ดูแลระบบ</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">รหัสผ่าน</label>
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Enter admin password"
            />
          </div>

          {error && <div className="text-sm text-rose-600 mb-4">❌ {error}</div>}

          <button
            onClick={handleLogin}
            className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 transition"
          >
            เข้าสู่ระบบ
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full mt-2 border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-100 transition"
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
      <div className="rounded-2xl border border-slate-300 bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-brand-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">⚙️ Admin Panel</h2>
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

        <div className="p-6 space-y-6">
          {successMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-700">
              ✅ {successMessage}
            </div>
          )}

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">📊 ข้อมูลระบบ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-600">เวลา:</p>
                <p className="font-mono text-slate-800">{new Date().toLocaleString('th-TH')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-600">Local Storage:</p>
                <p className="font-mono text-slate-800">{JSON.stringify(localStorage).length.toLocaleString('th-TH')} bytes</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-600">Session Storage:</p>
                <p className="font-mono text-slate-800">{JSON.stringify(sessionStorage).length.toLocaleString('th-TH')} bytes</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-600">Base URL:</p>
                <p className="font-mono text-slate-800 text-xs">{import.meta.env.BASE_URL || '/'}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">🗑️ จัดการข้อมูล</h3>
            <div className="space-y-3">
              <button
                onClick={handleClearImportHistory}
                className="w-full rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-3 font-medium border border-amber-300 transition"
              >
                ล้างประวัติการนำเข้า
              </button>
              <p className="text-xs text-slate-600">ลบข้อมูล import ที่ค้างอยู่ใน cache</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">🔄 ตัวเลือกขั้นสูง</h3>
            <div className="space-y-3">
              <button
                onClick={handleExportDiagnostics}
                className="w-full rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 px-4 py-3 font-medium border border-blue-300 transition"
              >
                📥 ดาวน์โหลด Diagnostics
              </button>
              <p className="text-xs text-slate-600">ส่งออกข้อมูลระบบและการตั้งค่า</p>

              <button
                onClick={handleClearCache}
                className="w-full rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 px-4 py-3 font-medium border border-rose-300 transition mt-4"
              >
                ⚠️ ล้างข้อมูล Cache ทั้งหมด
              </button>
              <p className="text-xs text-slate-600 text-rose-700">⚠️ ลบข้อมูลที่เก็บไว้ทั้งหมด (เช่น session, cache)</p>
            </div>
          </section>

          <section className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">📝 Storage Keys</h3>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {Object.keys(localStorage).length === 0 ? (
                <p className="text-slate-500">ไม่มี local storage keys</p>
              ) : (
                Object.keys(localStorage).map((key) => (
                  <p key={key} className="font-mono text-slate-600 break-all">
                    • {key}
                  </p>
                ))
              )}
            </div>
          </section>

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            Admin Panel v1.0 | Last login: {new Date().toLocaleString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
