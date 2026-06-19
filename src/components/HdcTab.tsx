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
import StrategicAnalysisView from './StrategicAnalysisView'
import CoverageView from './CoverageView'
import type { ReportInfoPanelProps } from './ReportInfoPanel'

const ALL_DOCS: ReportInfoPanelProps = {
  objective:
    'ดูว่าผู้รับบริการมาในรูปแบบใดบ้างจากทั้ง 5 รูปแบบ เพื่อเข้าใจ \'ส่วนผสม\' ของวิธีให้บริการ ไม่ใช่แค่ตัวเลขรวม',
  methodology:
    'นับจากฟิลด์ typein ในระบบ Hippo ตามนิยามต้นฉบับ — Type 1: มารับบริการเอง (Walk-in), Type 2: มีนัดหมายไว้หรือถูกส่งต่อมา (Appointment/Refer), Type 3: บริการเชิงรุก เช่น หน่วยแพทย์เคลื่อนที่หรือคัดกรองในชุมชน (Community outreach), Type 4: ให้บริการที่บ้าน (Home Visit), Type 5: การแพทย์ทางไกล (Telemedicine) มุมมองนี้แสดง Type 5 เป็นค่า \'Telemedicine\' ตรงตามนิยาม ไม่ได้รวมกับ Type 2/3 แบบที่ใช้ในมุมมองภาพรวม',
  source: 'ตาราง service ร่วมกับ icd10_chk_op',
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
    'ข้อมูลเฉพาะปีงบประมาณ 69 สำหรับสถานบริการที่กรอกข้อมูลเข้าระบบเอง (manual entry) ไม่ได้ดึงตรงจากระบบ Hippo เหมือนรายงานภาพรวม — แยกไว้เป็นรายงานต่างหากเพื่อไม่ให้ปนกับตัวเลขที่คำนวณด้วยสูตรอื่น',
  methodology:
    'ใช้ Service69 เป็นตัวหาร (แทน OP เนื่องจากไฟล์นี้ไม่มีคอลัมน์ OP) และ Telemed69 เป็นยอดโทรเวชกรรม — มีข้อมูลเฉพาะปีงบ 69 เท่านั้น ไม่มีปีงบ 68 ให้เทียบ สูตรนี้มาจากสมุดบันทึกคนละเล่มกับรายงานภาพรวม จึงไม่ควรนำตัวเลขทั้งสองรายงานมารวม/เทียบกันตรงๆ',
  source: 'ไฟล์กรอกมือที่ส่งออกจากระบบ Hippo เฉพาะส่วน (ไม่ใช่ตาราง service ทั้งหมดเหมือนภาพรวม)',
  template: 'q_telemed_hosp-235.ipynb',
}

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

type SubTabKey = 'base' | ReportCategory | 'strategic' | 'coverage'

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
  { key: 'base', label: 'ภาพรวม' },
  { key: 'coverage', label: 'ความครอบคลุม' },
  { key: 'typein', label: 'ข้อมูลกรอกมือ' },
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
    effectiveSubTab === 'base' || effectiveSubTab === 'coverage'
      ? null
      : effectiveSubTab === 'strategic'
        ? 'all'
        : (effectiveSubTab as ReportCategory)

  useEffect(() => {
    if (!categoryToFetch) return
    if (!selectedDate) return
    const category = categoryToFetch
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
  }, [categoryToFetch, selectedDate, categoryCache])

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
  const activeCategoryKey = categoryToFetch && selectedDate ? `${selectedDate}/${categoryToFetch}` : null
  const activeCategoryError =
    categoryError && categoryError.key === activeCategoryKey ? categoryError.message : null
  const activeCategoryReady =
    categoryToFetch && currentCategoryData ? Boolean(currentCategoryData[categoryToFetch]) : false

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

      <p className="text-xs text-slate-500">
        ปีงบประมาณ 68 = 1 ต.ค. 2567 – 30 ก.ย. 2568 · ปีงบประมาณ 69 = 1 ต.ค. 2568 – 30 ก.ย. 2569
        (ข้อมูลเฉพาะจังหวัดมุกดาหาร รหัส 49)
      </p>

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

      {snapshot && !isStale && effectiveSubTab === 'coverage' && <CoverageView snapshot={snapshot} />}

      {snapshot && !isStale && effectiveSubTab !== 'base' && effectiveSubTab !== 'coverage' && (
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
                  docs={ALL_DOCS}
                />
              )}
              {effectiveSubTab === 'person' && currentCategoryData.person && (
                <TypeBreakdownView
                  snapshot={currentCategoryData.person}
                  valueLabel="คน"
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
              {effectiveSubTab === 'typein' && currentCategoryData.typein && (
                <SnapshotView snapshot={currentCategoryData.typein} docs={TYPEIN_DOCS} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default HdcTab
