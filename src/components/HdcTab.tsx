import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  FollowupSnapshot,
  GroupBreakdownSnapshot,
  ReportCategory,
  Snapshot,
  SnapshotIndexEntry,
  TypeBreakdownSnapshot,
} from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { EMPTY_FILTERS, useFilteredData, type FilterState } from '../lib/useFilteredData'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useToast } from '../context/ToastContext'
import FilterBar from './FilterBar'
import RefreshControl from './RefreshControl'
import SnapshotView from './SnapshotView'
import TypeBreakdownView from './TypeBreakdownView'
import GroupBreakdownView from './GroupBreakdownView'
import FollowupView from './FollowupView'
import StrategicAnalysisView from './StrategicAnalysisView'
import LoadingSkeleton from './LoadingSkeleton'
import ErrorBoundary from './ErrorBoundary'
import type { ReportInfoPanelProps } from './ReportInfoPanel'

const ALL_DOCS: ReportInfoPanelProps = {
  objective:
    'เปรียบเทียบ OP68 กับผู้รับบริการ 3 รูปแบบหลักแบบการแพทย์ทางไกล (Type 2: Appointment/Refer + Type 3: Community outreach + Type 5: Telemedicine) เพื่อประเมินสัดส่วนการใช้บริการแบบไม่ต้องเข้าห้องอนุรักษ์',
  methodology:
    'ใช้ OP68 (จำนวนผู้รับบริการ OP ปีงบ 68) เป็นตัวหาร (ฐานงานเดิม) เทียบกับผลรวม Type2_69 + Type3_69 + Type5_69 (ปีงบ 69) เป็นตัวตั้ง สูตร: (Type2+Type3+Type5) ÷ OP68 × 100 — ตรงตามวิธีการใน q_telemed_hosp_muk.ipynb โดย Type2 = Appointment/Refer (นัดหมายหรือส่งต่อ), Type3 = Community outreach (บริการเชิงรุก/ชุมชน), Type5 = Telemedicine (การแพทย์ทางไกล)',
  source: 'ตาราง service (ระบบ Hippo) ร่วมกับตาราง icd10_chk_op',
  template: 'q_telemed_hosp_muk.ipynb',
}

const PERSON_DOCS: ReportInfoPanelProps = {
  objective:
    'เหมือนมุมมอง \'แยกประเภทบริการ\' แต่ตัดผลกระทบจากผู้ป่วยที่มารับบริการหลายครั้ง — นับ \'จำนวนคน\' ไม่ใช่ \'จำนวนครั้ง\' จึงเหมาะกับการประเมินความครอบคลุมของบริการมากกว่าปริมาณงาน',
  methodology:
    'นับจำนวนรหัสผู้ป่วย (pid) ที่ไม่ซ้ำกัน ต่อสถานบริการ ต่อปีงบประมาณ ต่อรูปแบบ typein เดียวกับมุมมอง \'แยกประเภทบริการ\'',
  source: 'ตาราง person ร่วมกับ service',
  template: 'q_telemed_hosp_muk.ipynb',
}

const NCD_DOCS: ReportInfoPanelProps = {
  objective:
    'ติดตามการใช้บริการโทรเวชกรรมในการดูแลผู้ป่วยโรคเรื้อรัง (NCD) 4 กลุ่มหลัก เพื่อดูว่ากลุ่มโรคใดเข้าถึงบริการทางไกลได้มากหรือน้อย',
  methodology:
    'จับคู่รหัสโรคเรื้อรังในตาราง chronic — เบาหวาน (รหัส E10-E14), ความดันโลหิตสูง (รหัส I10-I15), มะเร็ง (รหัสขึ้นต้นด้วย C ทั้งหมด), จิตเวช (รหัสขึ้นต้นด้วย F ทั้งหมด) นับเป็นการใช้โทรเวชกรรมเมื่อ typein=\'5\' เท่านั้น ตัวเลขรายกลุ่มโรคเป็นยอดรวมไม่แยกปีงบประมาณ (ต่างจากตัวเลข OP/Telemed รวมท้ายตารางซึ่งแยกตามปีงบตามปกติ)',
  source: 'ตาราง chronic ร่วมกับ service',
  template: 'q_telemed_hosp_muk.ipynb',
}

const MCH_DOCS: ReportInfoPanelProps = {
  objective: 'ติดตามการใช้บริการโทรเวชกรรมในงานอนามัยแม่และเด็ก 4 กลุ่มบริการหลัก',
  methodology:
    'จับคู่รหัสวินิจฉัยในตาราง diagnosis_opd — ฝากครรภ์/ANC (รหัสขึ้นต้นด้วย O หรือช่วง Z32-Z36), ดูแลหลังคลอด/PNC (รหัส Z39), ตรวจสุขภาพเด็กดี/WCC (รหัส Z001, Z761, Z762), วางแผนครอบครัว/FP (รหัส Z30) เช่นเดียวกับ NCD ตัวเลขรายกลุ่มเป็นยอดรวมไม่แยกปีงบประมาณ',
  source: 'ตาราง diagnosis_opd ร่วมกับ service',
  template: 'q_telemed_hosp_muk.ipynb',
}

const LTC_PAL_DOCS: ReportInfoPanelProps = {
  objective:
    'ติดตามการใช้บริการโทรเวชกรรมในงานดูแลผู้ป่วยระยะยาวและระยะท้าย — หมายเหตุสำคัญ: รายงานนี้แสดงเฉพาะสถานบริการที่มีเคสจริงในช่วงเวลานี้เท่านั้น สถานบริการที่ไม่มีเคส LTC/Palliative จะไม่ปรากฏในตาราง ไม่ได้หมายความว่าข้อมูลขาดหายหรือผิดพลาด',
  methodology: 'จับคู่รหัสวินิจฉัย Z74-Z75 = การดูแลระยะยาว (LTC), รหัส Z515 = การดูแลแบบประคับประคอง (Palliative)',
  source: 'ตาราง diagnosis_opd ร่วมกับ service',
  template: 'q_telemed_hosp_muk.ipynb',
}

const TYPEIN_DOCS: ReportInfoPanelProps = {
  objective:
    'ข้อมูลเฉพาะปีงบประมาณ 69 ตามเกณฑ์ที่ PH-EOC (ศูนย์ปฏิบัติการฉุกเฉินด้านการแพทย์และสาธารณสุข) กำหนดให้สถานบริการกรอกข้อมูลเข้าระบบเอง (manual entry) — ไม่ได้ดึงจากระบบ Hippo เหมือนแท็บ \'เกณฑ์ OP68 เทียบ Telemed69\' แยกไว้เป็นรายงานต่างหากเพื่อไม่ให้ปนกับตัวเลขจากแหล่งข้อมูลอื่น',
  methodology:
    'ใช้ Service69 (จำนวนผู้รับบริการรวมที่กรอกเข้า) เป็นตัวหาร และ Telemed69 (จำนวนผู้ใช้บริการโทรเวชกรรมที่กรอกเข้า) เป็นตัวตั้ง — ร้อยละคำนวณมาจากสูตร: Telemed69 ÷ Service69 × 100 โดยใช้ PercentTelemed69 จากไฟล์ต้นฉบับโดยตรง (ไม่คำนวณใหม่) มีข้อมูลเฉพาะปีงบ 69 เท่านั้น ไม่มีปีงบ 68 ให้เทียบ — สูตรนี้มาจากสมุดบันทึก q_telemed_hosp-235.ipynb ซึ่งต่างจากแท็บ \'เกณฑ์ OP68 เทียบ Telemed69\' (มาจาก q_telemed_hosp_muk.ipynb) ดังนั้นจึงไม่ควรนำตัวเลขทั้งสองรายงานมารวม/เทียบกันโดยตรง',
  source: 'ไฟล์กรอกมือตามเกณฑ์ PH-EOC (20260619_49_telemed_hosp_typein235.xlsx)',
  template: 'q_telemed_hosp-235.ipynb',
}

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

type SubTabKey = 'base' | ReportCategory | 'strategic'

// Sub-tabs whose visibility is gated by a NEW report category (beyond "base"),
// keyed by the tab's own key so 'strategic' can depend on the 'all' category
// data without being literally the 'all' tab.
const SUB_TAB_GATING_CATEGORY: Partial<Record<SubTabKey, ReportCategory>> = {
  all: 'all',
  person: 'person',
  ncd: 'ncd',
  mch: 'mch',
  ltc_pal: 'ltc_pal',
  followup: 'followup',
  strategic: 'all',
  typein: 'typein',
}

const SUB_TABS: { key: SubTabKey; label: string }[] = [
  { key: 'base', label: 'เกณฑ์ OP68 เทียบ Telemed69' },
  { key: 'typein', label: 'ข้อมูลเกณฑ์จาก PH-EOC' },
  { key: 'all', label: 'แยกประเภทบริการ' },
  { key: 'person', label: 'รายคน' },
  { key: 'ncd', label: 'NCD' },
  { key: 'mch', label: 'MCH' },
  { key: 'ltc_pal', label: 'LTC/Palliative' },
  { key: 'followup', label: 'ติดตามต่อเนื่อง' },
  { key: 'strategic', label: 'วิเคราะห์เชิงกลยุทธ์' },
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
  /** Same Snapshot/Facility shape as the base category — rendered via the
   * same SnapshotView component, just with different documentation text. */
  typein?: Snapshot
}

function HdcTab() {
  const toast = useToast()
  const [indexState, setIndexState] = useState<LoadState>({ status: 'loading' })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<{ date: string; message: string } | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('base')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)

  // Cache of fetched category snapshots, scoped to the currently-selected
  // date. Keyed by date so switching dates and back doesn't lose anything
  // already fetched, while still being per-date (categories differ by date).
  const [categoryCache, setCategoryCache] = useState<Record<string, CategoryDataMap>>({})
  const [categoryError, setCategoryError] = useState<{ key: string; message: string } | null>(null)

  const fetchIndex = useCallback(() => {
    return fetch(dataUrl('index.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SnapshotIndexEntry[]>
      })
      .then((index) => {
        if (!index || index.length === 0) {
          setIndexState({ status: 'empty' })
          return
        }
        // Keep the user's current date selection across a manual/auto
        // refresh instead of snapping back to the newest snapshot.
        setIndexState({ status: 'ready', index })
        setSelectedDate((prev) => prev ?? index[0].date)
      })
      .catch((err: unknown) => {
        setIndexState({
          status: 'error',
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้',
        })
        throw err
      })
  }, [])

  const fetchSnapshot = useCallback((date: string) => {
    return fetch(dataUrl(`${date}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Snapshot>
      })
      .then((data) => {
        setSnapshot(data)
      })
      .catch((err: unknown) => {
        setSnapshotError({
          date,
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลสแนปช็อตได้',
        })
        throw err
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchIndex().catch(() => {
      // surfaced via indexState; swallow here so this isn't an unhandled rejection
    })
    return () => {
      cancelled = true
      void cancelled
    }
    // Only run once on mount — refreshes go through refreshNow() instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    fetchSnapshot(selectedDate).catch(() => {
      // surfaced via snapshotError; swallow here so this isn't an unhandled rejection
    })
    return () => {
      cancelled = true
      void cancelled
    }
  }, [selectedDate, fetchSnapshot])

  const isStale = snapshot !== null && snapshot.snapshotDate !== selectedDate
  const currentError =
    snapshotError && snapshotError.date === selectedDate ? snapshotError.message : null

  const currentEntry = useMemo(() => {
    if (indexState.status !== 'ready' || !selectedDate) return null
    return indexState.index.find((e) => e.date === selectedDate) ?? null
  }, [indexState, selectedDate])

  const availableCategories = useMemo(() => currentEntry?.categories ?? [], [currentEntry])

  const filteredFacilities = useFilteredData(
    snapshot?.facilities ?? [],
    snapshot?.snapshotDate ?? null,
    availableCategories,
    filters,
  )
  const filteredSnapshot = useMemo(
    () => (snapshot ? { ...snapshot, facilities: filteredFacilities } : null),
    [snapshot, filteredFacilities],
  )

  const typeinSnapshot = selectedDate ? categoryCache[selectedDate]?.typein : undefined
  const filteredTypeinFacilities = useFilteredData(
    typeinSnapshot?.facilities ?? [],
    typeinSnapshot?.snapshotDate ?? null,
    availableCategories,
    filters,
  )
  const filteredTypeinSnapshot = useMemo(
    () => (typeinSnapshot ? { ...typeinSnapshot, facilities: filteredTypeinFacilities } : null),
    [typeinSnapshot, filteredTypeinFacilities],
  )

  const visibleSubTabs = useMemo(() => {
    return SUB_TABS.filter((tab) => {
      const gatingCategory = SUB_TAB_GATING_CATEGORY[tab.key]
      return !gatingCategory || availableCategories.includes(gatingCategory)
    })
  }, [availableCategories])

  // If the active sub-tab isn't available for the currently-selected date
  // (e.g. the user switched to an older date lacking that category), treat
  // the effective tab as "base" without an extra state-correcting effect —
  // same derive-during-render approach SnapshotView uses for its facility
  // selection cascade. The underlying activeSubTab state is left alone so
  // it's remembered if the user switches back to a date that has it.
  const effectiveSubTab: SubTabKey = (() => {
    const gatingCategory = SUB_TAB_GATING_CATEGORY[activeSubTab]
    return !gatingCategory || availableCategories.includes(gatingCategory) ? activeSubTab : 'base'
  })()

  // Lazy-fetch the active sub-tab's category data, only when needed, and
  // cache it per-date so flipping between sub-tabs doesn't re-fetch. The
  // 'strategic' tab has no JSON file of its own — it reuses the 'all'
  // category's cache slot (same data the "แยกประเภทบริการ" tab uses).
  const categoryToFetch: ReportCategory | null =
    effectiveSubTab === 'base'
      ? null
      : effectiveSubTab === 'strategic'
        ? 'all'
        : (effectiveSubTab as ReportCategory)

  const fetchCategory = useCallback((date: string, category: ReportCategory) => {
    return fetch(dataUrl(`${date}/${category}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setCategoryCache((prev) => ({
          ...prev,
          [date]: { ...prev[date], [category]: data },
        }))
      })
      .catch((err: unknown) => {
        setCategoryError({
          key: `${date}/${category}`,
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้',
        })
        throw err
      })
  }, [])

  useEffect(() => {
    if (!categoryToFetch) return
    if (!selectedDate) return
    if (categoryCache[selectedDate]?.[categoryToFetch]) return

    let cancelled = false
    fetchCategory(selectedDate, categoryToFetch).catch(() => {
      // surfaced via categoryError; swallow here so this isn't an unhandled rejection
    })
    return () => {
      cancelled = true
      void cancelled
    }
  }, [categoryToFetch, selectedDate, categoryCache, fetchCategory])

  // Drives the auto-refresh control. Re-fetches the lightweight index plus
  // whatever the user is currently looking at (the base snapshot, and the
  // active category if one is loaded) — never every category, so a refresh
  // tick doesn't fan out into a burst of requests.
  const refreshDashboard = useCallback(async () => {
    try {
      await fetchIndex()
      if (selectedDate) {
        await fetchSnapshot(selectedDate)
        if (categoryToFetch) {
          await fetchCategory(selectedDate, categoryToFetch)
        }
      }
      toast.show('ข้อมูลรีเฟรชสำเร็จ', 'success')
    } catch (error) {
      toast.show('รีเฟรชไม่สำเร็จ', 'error')
    }
  }, [fetchIndex, fetchSnapshot, fetchCategory, selectedDate, categoryToFetch, toast])

  const autoRefresh = useAutoRefresh({ onRefresh: refreshDashboard })

  if (indexState.status === 'loading') {
    return <LoadingSkeleton />
  }

  if (indexState.status === 'error') {
    return (
      <ErrorBoundary label="โหลดข้อมูล">
        <div className="rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-orange-50 p-6 text-center shadow-md dark:border-rose-700 dark:from-slate-800 dark:to-slate-800">
          <p className="text-2xl">⚠️</p>
          <h2 className="mt-2 text-lg font-bold text-rose-700 dark:text-rose-400">เกิดข้อผิดพลาด</h2>
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">{indexState.message}</p>
        </div>
      </ErrorBoundary>
    )
  }

  if (indexState.status === 'empty') {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-slate-600 dark:bg-slate-900">
        <p className="text-4xl">📭</p>
        <h2 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">ยังไม่มีข้อมูล</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">กรุณาอัปโหลดไฟล์ Excel เพื่อสร้างสแนปช็อตข้อมูล</p>
      </div>
    )
  }

  const { index } = indexState
  const currentCategoryData = selectedDate ? categoryCache[selectedDate] : undefined
  const activeCategoryKey = categoryToFetch && selectedDate ? `${selectedDate}/${categoryToFetch}` : null
  const activeCategoryError =
    categoryError && categoryError.key === activeCategoryKey ? categoryError.message : null
  const activeCategoryReady =
    categoryToFetch && currentCategoryData ? Boolean(currentCategoryData[categoryToFetch]) : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label htmlFor="snapshot-select" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          ข้อมูล ณ วันที่
        </label>
        <select
          id="snapshot-select"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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

      <RefreshControl state={autoRefresh} />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        ปีงบประมาณ 68 = 1 ต.ค. 2567 – 30 ก.ย. 2568 · ปีงบประมาณ 69 = 1 ต.ค. 2568 – 30 ก.ย. 2569
        (ข้อมูลเฉพาะจังหวัดมุกดาหาร รหัส 49)
      </p>

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {visibleSubTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              effectiveSubTab === tab.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          เกิดข้อผิดพลาดในการโหลดสแนปช็อต: {currentError}
        </p>
      )}

      {(!snapshot || isStale) && !currentError && (
        <p className="text-center text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลสแนปช็อต...</p>
      )}

      {snapshot && !isStale && (effectiveSubTab === 'base' || effectiveSubTab === 'typein') && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableTypes={availableCategories}
          resultCount={
            effectiveSubTab === 'typein' ? filteredTypeinFacilities.length : filteredFacilities.length
          }
        />
      )}

      {snapshot && !isStale && effectiveSubTab === 'base' && filteredSnapshot && (
        <SnapshotView snapshot={filteredSnapshot} snapshotIndex={index} />
      )}

      {snapshot && !isStale && effectiveSubTab !== 'base' && (
        <>
          {!activeCategoryReady && !activeCategoryError && (
            <LoadingSkeleton />
          )}
          {activeCategoryError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              เกิดข้อผิดพลาดในการโหลดข้อมูล: {activeCategoryError}
            </p>
          )}
          {activeCategoryReady && currentCategoryData && (
            <>
              {effectiveSubTab === 'all' && currentCategoryData.all && (
                <TypeBreakdownView
                  snapshot={currentCategoryData.all}
                  title="แยกประเภทบริการ"
                  docs={ALL_DOCS}
                />
              )}
              {effectiveSubTab === 'person' && currentCategoryData.person && (
                <TypeBreakdownView
                  snapshot={currentCategoryData.person}
                  title="รายคน"
                  docs={PERSON_DOCS}
                />
              )}
              {effectiveSubTab === 'ncd' && currentCategoryData.ncd && (
                <GroupBreakdownView snapshot={currentCategoryData.ncd} title="NCD" docs={NCD_DOCS} />
              )}
              {effectiveSubTab === 'mch' && currentCategoryData.mch && (
                <GroupBreakdownView snapshot={currentCategoryData.mch} title="MCH" docs={MCH_DOCS} />
              )}
              {effectiveSubTab === 'ltc_pal' && currentCategoryData.ltc_pal && (
                <GroupBreakdownView
                  snapshot={currentCategoryData.ltc_pal}
                  title="LTC/Palliative"
                  docs={LTC_PAL_DOCS}
                />
              )}
              {effectiveSubTab === 'followup' && currentCategoryData.followup && (
                <FollowupView snapshot={currentCategoryData.followup} />
              )}
              {effectiveSubTab === 'strategic' && currentCategoryData.all && (
                <StrategicAnalysisView baseSnapshot={snapshot} allSnapshot={currentCategoryData.all} />
              )}
              {effectiveSubTab === 'typein' && filteredTypeinSnapshot && (
                <SnapshotView snapshot={filteredTypeinSnapshot} docs={TYPEIN_DOCS} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default HdcTab
