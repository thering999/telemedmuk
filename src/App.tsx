import { lazy, Suspense, useEffect, useState } from 'react'
import DarkModeToggle from './components/DarkModeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { FiscalYearProvider } from './context/FiscalYearContext'
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
    <FiscalYearProvider>
      <div className="app-bg min-h-screen">
        <DarkModeToggle isDark={isDark} onToggle={toggleDarkMode} />
      <header className="header-vivid relative overflow-hidden shadow-lg">
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-7 sm:px-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold text-white drop-shadow-sm sm:text-4xl">
              📊 Dashboard Telemedicine จังหวัดมุกดาหาร
            </h1>
            <p className="mt-2 text-sm font-medium text-white/90">
              ✨ ภาพรวมการให้บริการ Telemedicine ในพื้นที่จังหวัดมุกดาหาร
            </p>
          </div>
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-2 mr-12 text-white/80 hover:text-white text-2xl font-medium transition-all hover:scale-110 hover:rotate-45 sm:mr-0"
            title="Admin Panel"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorBoundary label="หน้าหลัก">
          <div className="mb-6 overflow-x-auto rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-md backdrop-blur hover:shadow-lg transition-shadow dark:border-slate-600 dark:bg-slate-800/70">
            <div className="flex w-max gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap transition-all sm:px-4 sm:py-2 sm:text-sm ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/30'
                      : 'text-slate-700 hover:bg-gradient-to-r hover:from-teal-50 hover:via-cyan-50 hover:to-indigo-50 hover:text-cyan-700 dark:text-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
    </FiscalYearProvider>
    </ToastProvider>
  )
}

export default App
