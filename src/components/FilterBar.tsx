import type { ReportCategory } from '../types/hdc'
import type { FilterState } from '../lib/useFilteredData'

const TYPE_LABELS: Record<ReportCategory, string> = {
  all: 'แยกประเภทบริการ',
  person: 'รายคน',
  ncd: 'NCD',
  mch: 'MCH',
  ltc_pal: 'LTC/Palliative',
  followup: 'ติดตามต่อเนื่อง',
  typein: 'PH-EOC',
}

export interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  /** Data-type quick filter buttons to offer — only categories available for the current snapshot. */
  availableTypes: ReportCategory[]
  resultCount: number
}

function FilterBar({ filters, onChange, availableTypes, resultCount }: FilterBarProps) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const clearAll = () =>
    onChange({ search: '', dateFrom: '', dateTo: '', type: null })

  const hasFilters = Boolean(filters.search || filters.dateFrom || filters.dateTo || filters.type)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-search" className="text-xs font-medium text-slate-600">
          ค้นหา (รหัสสถาน / ชื่อสถานพยาบาล)
        </label>
        <input
          id="filter-search"
          type="text"
          placeholder="พิมพ์เพื่อค้นหา..."
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-56"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-from" className="text-xs font-medium text-slate-600">
          ตั้งแต่วันที่
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-to" className="text-xs font-medium text-slate-600">
          ถึงวันที่
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ประเภทข้อมูล</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set({ type: null })}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              filters.type === null
                ? 'bg-brand-600 text-white shadow-md'
                : 'border-2 border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            ทั้งหมด
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set({ type })}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                filters.type === type
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'border-2 border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-auto">
        <span className="whitespace-nowrap text-xs text-slate-500">
          พบ {resultCount.toLocaleString('th-TH')} รายการ
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  )
}

export default FilterBar
