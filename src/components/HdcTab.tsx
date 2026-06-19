import { useEffect, useMemo, useState } from 'react'
import type {
  FollowupSnapshot,
  GroupBreakdownSnapshot,
  ReportCategory,
  Snapshot,
  SnapshotIndexEntry,
  TypeBreakdownSnapshot,
} from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import SnapshotView from './SnapshotView'
import TypeBreakdownView from './TypeBreakdownView'
import GroupBreakdownView from './GroupBreakdownView'
import FollowupView from './FollowupView'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

type SubTabKey = 'base' | ReportCategory

const SUB_TABS: { key: SubTabKey; label: string }[] = [
  { key: 'base', label: 'ภาพรวม' },
  { key: 'all', label: 'แยกประเภทบริการ' },
  { key: 'person', label: 'รายคน' },
  { key: 'ncd', label: 'NCD' },
  { key: 'mch', label: 'MCH' },
  { key: 'ltc_pal', label: 'LTC/Palliative' },
  { key: 'followup', label: 'ติดตามต่อเนื่อง' },
]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; index: SnapshotIndexEntry[] }

// Union of every category snapshot shape, keyed by category so the cache can
// hold mixed types per date without losing type information at the call site.
interface CategoryDataMap {
  all?: TypeBreakdownSnapshot
  person?: TypeBreakdownSnapshot
  ncd?: GroupBreakdownSnapshot
  mch?: GroupBreakdownSnapshot
  ltc_pal?: GroupBreakdownSnapshot
  followup?: FollowupSnapshot
}

function HdcTab() {
  const [indexState, setIndexState] = useState<LoadState>({ status: 'loading' })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<{ date: string; message: string } | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('base')

  // Cache of fetched category snapshots, scoped to the currently-selected
  // date. Keyed by date so switching dates and back doesn't lose anything
  // already fetched, while still being per-date (categories differ by date).
  const [categoryCache, setCategoryCache] = useState<Record<string, CategoryDataMap>>({})
  const [categoryError, setCategoryError] = useState<{ key: string; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(dataUrl('index.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SnapshotIndexEntry[]>
      })
      .then((index) => {
        if (cancelled) return
        if (!index || index.length === 0) {
          setIndexState({ status: 'empty' })
          return
        }
        setIndexState({ status: 'ready', index })
        setSelectedDate(index[0].date)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setIndexState({
          status: 'error',
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    fetch(dataUrl(`${selectedDate}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Snapshot>
      })
      .then((data) => {
        if (cancelled) return
        setSnapshot(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSnapshotError({
          date: selectedDate,
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลสแนปช็อตได้',
        })
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const isStale = snapshot !== null && snapshot.snapshotDate !== selectedDate
  const currentError =
    snapshotError && snapshotError.date === selectedDate ? snapshotError.message : null

  const currentEntry = useMemo(() => {
    if (indexState.status !== 'ready' || !selectedDate) return null
    return indexState.index.find((e) => e.date === selectedDate) ?? null
  }, [indexState, selectedDate])

  const availableCategories = useMemo(() => currentEntry?.categories ?? [], [currentEntry])

  const visibleSubTabs = useMemo(() => {
    return SUB_TABS.filter((tab) => tab.key === 'base' || availableCategories.includes(tab.key as ReportCategory))
  }, [availableCategories])

  // If the active sub-tab isn't available for the currently-selected date
  // (e.g. the user switched to an older date lacking that category), treat
  // the effective tab as "base" without an extra state-correcting effect —
  // same derive-during-render approach SnapshotView uses for its facility
  // selection cascade. The underlying activeSubTab state is left alone so
  // it's remembered if the user switches back to a date that has it.
  const effectiveSubTab: SubTabKey =
    activeSubTab === 'base' || availableCategories.includes(activeSubTab as ReportCategory)
      ? activeSubTab
      : 'base'

  // Lazy-fetch the active sub-tab's category data, only when needed, and
  // cache it per-date so flipping between sub-tabs doesn't re-fetch.
  useEffect(() => {
    if (effectiveSubTab === 'base') return
    if (!selectedDate) return
    const category = effectiveSubTab as ReportCategory
    if (categoryCache[selectedDate]?.[category]) return

    let cancelled = false
    fetch(dataUrl(`${selectedDate}/${category}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setCategoryCache((prev) => ({
          ...prev,
          [selectedDate]: { ...prev[selectedDate], [category]: data },
        }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setCategoryError({
          key: `${selectedDate}/${category}`,
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้',
        })
      })
    return () => {
      cancelled = true
    }
  }, [effectiveSubTab, selectedDate, categoryCache])

  if (indexState.status === 'loading') {
    return <p className="text-center text-slate-500">กำลังโหลดข้อมูล...</p>
  }

  if (indexState.status === 'error') {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
        เกิดข้อผิดพลาดในการโหลดข้อมูล: {indexState.message}
      </p>
    )
  }

  if (indexState.status === 'empty') {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500 shadow-sm">
        ยังไม่มีข้อมูลที่นำเข้า กรุณาอัปโหลดไฟล์ Excel เพื่อสร้างสแนปช็อตข้อมูล
      </p>
    )
  }

  const { index } = indexState
  const currentCategoryData = selectedDate ? categoryCache[selectedDate] : undefined
  const activeCategoryKey =
    effectiveSubTab !== 'base' && selectedDate ? `${selectedDate}/${effectiveSubTab}` : null
  const activeCategoryError =
    categoryError && categoryError.key === activeCategoryKey ? categoryError.message : null
  const activeCategoryReady =
    effectiveSubTab !== 'base' && currentCategoryData
      ? Boolean(currentCategoryData[effectiveSubTab as ReportCategory])
      : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <label htmlFor="snapshot-select" className="text-sm font-medium text-slate-600">
          ข้อมูล ณ วันที่
        </label>
        <select
          id="snapshot-select"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          value={selectedDate ?? ''}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          {index.map((entry) => (
            <option key={entry.date} value={entry.date}>
              ข้อมูล ณ {formatThaiDate(entry.date)}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {visibleSubTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              effectiveSubTab === tab.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          เกิดข้อผิดพลาดในการโหลดสแนปช็อต: {currentError}
        </p>
      )}

      {(!snapshot || isStale) && !currentError && (
        <p className="text-center text-slate-500">กำลังโหลดข้อมูลสแนปช็อต...</p>
      )}

      {snapshot && !isStale && effectiveSubTab === 'base' && (
        <SnapshotView snapshot={snapshot} snapshotIndex={index} />
      )}

      {snapshot && !isStale && effectiveSubTab !== 'base' && (
        <>
          {!activeCategoryReady && !activeCategoryError && (
            <p className="text-center text-slate-500">กำลังโหลดข้อมูล...</p>
          )}
          {activeCategoryError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              เกิดข้อผิดพลาดในการโหลดข้อมูล: {activeCategoryError}
            </p>
          )}
          {activeCategoryReady && currentCategoryData && (
            <>
              {effectiveSubTab === 'all' && currentCategoryData.all && (
                <TypeBreakdownView
                  snapshot={currentCategoryData.all}
                  valueLabel="ครั้ง"
                  title="แยกประเภทบริการ"
                />
              )}
              {effectiveSubTab === 'person' && currentCategoryData.person && (
                <TypeBreakdownView snapshot={currentCategoryData.person} valueLabel="คน" title="รายคน" />
              )}
              {effectiveSubTab === 'ncd' && currentCategoryData.ncd && (
                <GroupBreakdownView snapshot={currentCategoryData.ncd} title="NCD" />
              )}
              {effectiveSubTab === 'mch' && currentCategoryData.mch && (
                <GroupBreakdownView snapshot={currentCategoryData.mch} title="MCH" />
              )}
              {effectiveSubTab === 'ltc_pal' && currentCategoryData.ltc_pal && (
                <GroupBreakdownView snapshot={currentCategoryData.ltc_pal} title="LTC/Palliative" />
              )}
              {effectiveSubTab === 'followup' && currentCategoryData.followup && (
                <FollowupView snapshot={currentCategoryData.followup} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default HdcTab
