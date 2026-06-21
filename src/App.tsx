import { lazy, Suspense, useEffect, useState } from 'react'
import DarkModeToggle from './components/DarkModeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { useDarkMode } from './hooks/useDarkMode'
import type { SnapshotIndexEntry } from './types/hdc'

// Each tab (and the admin panel) is its own chunk -- they pull in heavy deps
// (recharts, xlsx) that shouldn't block the initial paint of the shell/tab bar.
const PowerBiTab = lazy(() => import('./components/PowerBiTab'))
const LookerStudioTab = lazy(() => import('./components/LookerStudioTab'))
const HdcTab = lazy(() => import('./components/HdcTab'))
const ImportExcelTab = lazy(() => import('./components/ImportExcelTab'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const ComparisonView = lazy(() => import('./components/ComparisonView'))

function TabFallback() {
  return <p className="text-center text-slate-500 dark:text-slate-400">กำลังโหลด...</p>
}

type TabKey = 'powerbi' | 'looker' | 'hdc' | 'import' | 'compare'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hdc', label: 'ข้อมูล HDC (Hippo)' },
  { key: 'powerbi', label: 'ข้อมูล Telemedicine (Power BI)' },
  { key: 'looker', label: 'ข้อมูล Telemedicine (Looker Studio)' },
  { key: 'import', label: 'นำเข้า Excel' },
  { key: 'compare', label: 'เปรียบเทียบ' },
]

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('hdc')
  const [showAdmin, setShowAdmin] = useState(false)
  const [snapshotIndex, setSnapshotIndex] = useState<SnapshotIndexEntry[] | null>(null)
  const { isDark, toggleDarkMode } = useDarkMode()

  useEffect(() => {
    if (activeTab !== 'compare' || snapshotIndex) return
    let cancelled = false
    fetch(dataUrl('index.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SnapshotIndexEntry[]>
      })
      .then((index) => {
        if (!cancelled) setSnapshotIndex(index)
      })
      .catch(() => {
        if (!cancelled) setSnapshotIndex([])
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, snapshotIndex])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-950">
        <DarkModeToggle isDark={isDark} onToggle={toggleDarkMode} />
      <header className="relative border-b-2 border-cyan-300 bg-gradient-to-r from-white via-blue-50 to-cyan-50 shadow-md dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-teal-600 sm:text-4xl dark:from-cyan-400 dark:to-teal-400">
              📊 Dashboard Telemedicine จังหวัดมุกดาหาร
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              ✨ ภาพรวมการให้บริการ Telemedicine ในพื้นที่จังหวัดมุกดาหาร
            </p>
          </div>
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-2 mr-12 text-slate-500 hover:text-cyan-600 text-2xl font-medium transition-all hover:scale-110 dark:text-slate-400 dark:hover:text-cyan-400 sm:mr-0"
            title="Admin Panel"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorBoundary label="หน้าหลัก">
          <div className="mb-6 inline-flex rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-white to-blue-50 p-1 shadow-md hover:shadow-lg transition-shadow dark:border-slate-600 dark:from-slate-800 dark:to-slate-800">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all sm:text-base ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg scale-105'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100 dark:text-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'powerbi' && (
            <ErrorBoundary key="powerbi" label="แท็บ Power BI">
              <Suspense fallback={<TabFallback />}>
                <PowerBiTab />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'looker' && (
            <ErrorBoundary key="looker" label="แท็บ Looker Studio">
              <Suspense fallback={<TabFallback />}>
                <LookerStudioTab />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'hdc' && (
            <ErrorBoundary key="hdc" label="แท็บ HDC">
              <Suspense fallback={<TabFallback />}>
                <HdcTab />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'import' && (
            <ErrorBoundary key="import" label="แท็บนำเข้า Excel">
              <Suspense fallback={<TabFallback />}>
                <ImportExcelTab />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'compare' && snapshotIndex === null && (
            <p className="text-center text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูล...</p>
          )}
          {activeTab === 'compare' && snapshotIndex !== null && (
            <ErrorBoundary key="compare" label="แท็บเปรียบเทียบ">
              <Suspense fallback={<TabFallback />}>
                <ComparisonView snapshotIndex={snapshotIndex} />
              </Suspense>
            </ErrorBoundary>
          )}
        </ErrorBoundary>
      </main>

      {showAdmin && (
        <Suspense fallback={null}>
          <AdminPanel onClose={() => setShowAdmin(false)} />
        </Suspense>
      )}
      </div>
    </ToastProvider>
  )
}

export default App
