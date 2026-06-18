import { useState } from 'react'
import PowerBiTab from './components/PowerBiTab'
import HdcTab from './components/HdcTab'

type TabKey = 'powerbi' | 'hdc'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'powerbi', label: 'ข้อมูลโทรเวชกรรม (Power BI)' },
  { key: 'hdc', label: 'ข้อมูล HDC (Hippo)' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('powerbi')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
            Dashboard โทรเวชกรรม จังหวัดมุกดาหาร
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ภาพรวมการให้บริการโทรเวชกรรมในพื้นที่จังหวัดมุกดาหาร
          </p>
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

        {activeTab === 'powerbi' ? <PowerBiTab /> : <HdcTab />}
      </main>
    </div>
  )
}

export default App
