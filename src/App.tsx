import { useState } from 'react'
import PowerBiTab from './components/PowerBiTab'
import LookerStudioTab from './components/LookerStudioTab'
import HdcTab from './components/HdcTab'
import ImportExcelTab from './components/ImportExcelTab'
import AdminPanel from './components/AdminPanel'

type TabKey = 'powerbi' | 'looker' | 'hdc' | 'import'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'powerbi', label: 'ข้อมูล Telemedicine (Power BI)' },
  { key: 'looker', label: 'ข้อมูล Telemedicine (Looker Studio)' },
  { key: 'hdc', label: 'ข้อมูล HDC (Hippo)' },
  { key: 'import', label: 'นำเข้า Excel' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('powerbi')
  const [showAdmin, setShowAdmin] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
              Dashboard Telemedicine จังหวัดมุกดาหาร
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ภาพรวมการให้บริการ Telemedicine ในพื้นที่จังหวัดมุกดาหาร
            </p>
          </div>
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition"
            title="Admin Panel"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:text-base ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'powerbi' && <PowerBiTab />}
        {activeTab === 'looker' && <LookerStudioTab />}
        {activeTab === 'hdc' && <HdcTab />}
        {activeTab === 'import' && <ImportExcelTab />}
      </main>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  )
}

export default App
