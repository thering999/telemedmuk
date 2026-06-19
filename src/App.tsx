import { useState } from 'react'
import PowerBiTab from './components/PowerBiTab'
import LookerStudioTab from './components/LookerStudioTab'
import HdcTab from './components/HdcTab'
import ImportExcelTab from './components/ImportExcelTab'
import AdminPanel from './components/AdminPanel'

type TabKey = 'powerbi' | 'looker' | 'hdc' | 'import'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hdc', label: 'ข้อมูล HDC (Hippo)' },
  { key: 'powerbi', label: 'ข้อมูล Telemedicine (Power BI)' },
  { key: 'looker', label: 'ข้อมูล Telemedicine (Looker Studio)' },
  { key: 'import', label: 'นำเข้า Excel' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('hdc')
  const [showAdmin, setShowAdmin] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
      <header className="border-b-2 border-cyan-300 bg-gradient-to-r from-white via-blue-50 to-cyan-50 shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-teal-600 sm:text-4xl">
              📊 Dashboard Telemedicine จังหวัดมุกดาหาร
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              ✨ ภาพรวมการให้บริการ Telemedicine ในพื้นที่จังหวัดมุกดาหาร
            </p>
          </div>
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-2 text-slate-500 hover:text-cyan-600 text-2xl font-medium transition-all hover:scale-110"
            title="Admin Panel"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 inline-flex rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-white to-blue-50 p-1 shadow-md hover:shadow-lg transition-shadow">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all sm:text-base ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'text-slate-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100'
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
