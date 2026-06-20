import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { FiscalYear, Snapshot, TypeBreakdownSnapshot, TypeYearStats } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import ReportInfoPanel from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'
import { useSortableTable } from '../lib/useSortableTable'
import SortableTh from './SortableTh'

export interface StrategicAnalysisViewProps {
  baseSnapshot: Snapshot
  allSnapshot: TypeBreakdownSnapshot
}

type Quadrant = 'champions' | 'sleepingGiants' | 'activeSmall' | 'waitingForSupport'

const QUADRANT_META: Record<Quadrant, { label: string; color: string }> = {
  champions: { label: 'Champions (ต้นแบบ)', color: '#0d9488' },
  sleepingGiants: { label: 'Sleeping Giants (ศักยภาพสูงที่ต้องกระตุ้น)', color: '#f59e0b' },
  activeSmall: { label: 'Active Small (จิ๋วแต่แจ๋ว)', color: '#2563eb' },
  waitingForSupport: { label: 'Waiting for Support (กลุ่มรอการสนับสนุน)', color: '#94a3b8' },
}

const DISTRICT_TARGET_RATE = 30
const RPST_TARGET_RATE = 10
const RPST_HOSTYPE_MATCH = 'ส่งเสริมสุขภาพตำบล'

interface CombinedFacility {
  hospcode: string
  hospname: string
  ampName: string
  hostypeName: string
  mName: string
  byYear: Partial<Record<FiscalYear, TypeYearStats>>
}

function officialDenominator(stats: TypeYearStats | undefined): number {
  if (!stats) return 0
  return stats.op
}

/** Type5 (Telemedicine) ÷ OP × 100 — the same definition used everywhere else in this
 * dashboard (q_telemed_hosp_muk.ipynb's own convention), so this view's percentage reads
 * consistently with ภาพรวม/แยกประเภทบริการ instead of introducing a second, differently-scaled
 * "official" formula. Null when OP is 0 ("ไม่มีข้อมูล"), never NaN/0-by-force. */
function officialRate(stats: TypeYearStats | undefined): number | null {
  if (!stats) return null
  const op = officialDenominator(stats)
  if (op <= 0) return null
  return (stats.type5 / op) * 100
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function classifyQuadrant(op: number, rate: number, medianOp: number, medianRate: number): Quadrant {
  const highOp = op >= medianOp
  const highRate = rate >= medianRate
  if (highOp && highRate) return 'champions'
  if (highOp && !highRate) return 'sleepingGiants'
  if (!highOp && highRate) return 'activeSmall'
  return 'waitingForSupport'
}

const ALL_HOSTYPES = '__all__'

function StrategicAnalysisView({ baseSnapshot, allSnapshot }: StrategicAnalysisViewProps) {
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')
  const [search, setSearch] = useState('')
  // Only affects the bottom "รายละเอียดสถานพยาบาล" table below — the tiered
  // target sections (district ≥30%, รพ.สต. ≥10%) intentionally always see
  // every facility type, since "อำเภอ รวม รพ.+รพ.สต." only means something
  // when both types are present.
  const [hostype, setHostype] = useState<string>(ALL_HOSTYPES)

  const [prevSnapshot, setPrevSnapshot] = useState(allSnapshot)
  if (allSnapshot !== prevSnapshot) {
    setPrevSnapshot(allSnapshot)
    setSearch('')
    setHostype(ALL_HOSTYPES)
  }

  // Join step: base snapshot (mcode/mName) + all-category snapshot (Type1-5 byYear), keyed by hospcode.
  // Facilities in allSnapshot but missing from the base lookup fall back to 'ไม่ทราบสังกัด' rather than crash.
  const combinedFacilities = useMemo<CombinedFacility[]>(() => {
    const baseByCode = new Map(baseSnapshot.facilities.map((f) => [f.hospcode, f]))
    return allSnapshot.facilities.map((f) => {
      const base = baseByCode.get(f.hospcode)
      return {
        hospcode: f.hospcode,
        hospname: f.hospname,
        ampName: f.ampName,
        hostypeName: f.hostypeName,
        mName: base?.mName ?? 'ไม่ทราบสังกัด',
        byYear: f.byYear,
      }
    })
  }, [baseSnapshot, allSnapshot])

  const filteredFacilities = useMemo<CombinedFacility[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return combinedFacilities
    return combinedFacilities.filter((f) => {
      return (
        f.hospname.toLowerCase().includes(q) ||
        f.ampName.toLowerCase().includes(q) ||
        f.hospcode.toLowerCase().includes(q)
      )
    })
  }, [combinedFacilities, search])

  // Per-facility derived stats for the selected year.
  const yearRows = useMemo(() => {
    return filteredFacilities.map((f) => {
      const stats = f.byYear[fiscalYear]
      const rate = officialRate(stats)
      const denominator = officialDenominator(stats)
      const op = stats?.op ?? 0
      const type5 = stats?.type5 ?? 0
      return { facility: f, stats, rate, denominator, op, type5 }
    })
  }, [filteredFacilities, fiscalYear])

  const hostypeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of combinedFacilities) set.add(f.hostypeName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [combinedFacilities])

  // Facility-type-filtered rows, used ONLY by the bottom table — every other
  // computed section above intentionally ignores this filter (see comment on
  // the `hostype` state declaration).
  const tableRows = useMemo(() => {
    if (hostype === ALL_HOSTYPES) return yearRows
    return yearRows.filter((row) => row.facility.hostypeName === hostype)
  }, [yearRows, hostype])

  // Province-wide KPI summary (aggregate across facilities currently in scope).
  const provinceKpis = useMemo(() => {
    let sumType5 = 0
    let sumDenominator = 0
    let withType5 = 0
    let anomalyCount = 0
    let scoped = 0
    for (const row of yearRows) {
      if (!row.stats) continue
      scoped++
      sumType5 += row.type5
      sumDenominator += row.denominator
      if (row.type5 > 0) withType5++
      if (row.rate !== null && row.rate > 50) anomalyCount++
    }
    const aggregateRate = sumDenominator > 0 ? (sumType5 / sumDenominator) * 100 : null
    const activationRate = scoped > 0 ? (withType5 / scoped) * 100 : null
    return { aggregateRate, activationRate, anomalyCount, scoped }
  }, [yearRows])

  // Simple forecast: province-wide Type5 total for 69 + (69 - 68), clamped at 0. Hidden if FY68 missing.
  const forecast = useMemo(() => {
    let total68 = 0
    let total69 = 0
    let has68 = false
    let has69 = false
    for (const f of filteredFacilities) {
      const s68 = f.byYear['68']
      const s69 = f.byYear['69']
      if (s68) {
        has68 = true
        total68 += s68.type5
      }
      if (s69) {
        has69 = true
        total69 += s69.type5
      }
    }
    if (!has68 || !has69) return null
    const projected = Math.max(0, total69 + (total69 - total68))
    return { total68, total69, projected }
  }, [filteredFacilities])

  // MOPH vs LGO (สังกัด) comparison — grouped by whatever mName values actually appear.
  const affiliationComparison = useMemo(() => {
    const byAffiliation = new Map<
      string,
      { mName: string; count: number; totalOp: number; totalType5: number; totalDenominator: number }
    >()
    for (const row of yearRows) {
      if (!row.stats) continue
      const key = row.facility.mName
      const entry =
        byAffiliation.get(key) ?? { mName: key, count: 0, totalOp: 0, totalType5: 0, totalDenominator: 0 }
      entry.count += 1
      entry.totalOp += row.op
      entry.totalType5 += row.type5
      entry.totalDenominator += row.denominator
      byAffiliation.set(key, entry)
    }
    return Array.from(byAffiliation.values())
      .map((entry) => ({
        ...entry,
        rate: entry.totalDenominator > 0 ? (entry.totalType5 / entry.totalDenominator) * 100 : null,
      }))
      .sort((a, b) => b.count - a.count)
  }, [yearRows])

  // 4-quadrant strategic segmentation — only facilities with a defined rate (denominator > 0) are scored.
  const quadrantData = useMemo(() => {
    const scorable = yearRows.filter((row) => row.rate !== null)
    const medianOp = median(scorable.map((row) => row.op))
    const medianRate = median(scorable.map((row) => row.rate as number))
    const classified = scorable.map((row) => ({
      ...row,
      quadrant: classifyQuadrant(row.op, row.rate as number, medianOp, medianRate),
    }))
    const groups: Record<Quadrant, typeof classified> = {
      champions: [],
      sleepingGiants: [],
      activeSmall: [],
      waitingForSupport: [],
    }
    for (const row of classified) {
      groups[row.quadrant].push(row)
    }
    const lookup = new Map(classified.map((row) => [row.facility.hospcode, row.quadrant]))
    return { medianOp, medianRate, groups, lookup }
  }, [yearRows])

  const scatterSeries = useMemo(() => {
    return (Object.keys(QUADRANT_META) as Quadrant[]).map((quadrant) => ({
      quadrant,
      label: QUADRANT_META[quadrant].label,
      color: QUADRANT_META[quadrant].color,
      points: quadrantData.groups[quadrant].map((row) => ({
        op: row.op,
        rate: row.rate,
        name: row.facility.hospname,
      })),
    }))
  }, [quadrantData])

  // Anomaly review table: rate > 50% for the selected year.
  const anomalyRows = useMemo(() => {
    return yearRows.filter((row) => row.rate !== null && row.rate > 50)
  }, [yearRows])

  const exportColumns = useMemo<ExportColumn<(typeof tableRows)[number]>[]>(() => {
    return [
      { key: 'hospcode', label: 'รหัสสถาน', value: (row) => row.facility.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (row) => row.facility.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (row) => row.facility.ampName },
      { key: 'mName', label: 'สังกัด', value: (row) => row.facility.mName },
      { key: 'hostypeName', label: 'ประเภท', value: (row) => row.facility.hostypeName },
      { key: 'op', label: 'OP', value: (row) => row.op },
      { key: 'type5', label: 'Type5 (Telemedicine)', value: (row) => row.type5 },
      { key: 'rate', label: 'อัตรา %', value: (row) => (row.rate === null ? '' : Number(row.rate.toFixed(2))) },
      {
        key: 'quadrant',
        label: 'กลุ่มเชิงกลยุทธ์',
        value: (row) => {
          const quadrant = quadrantData.lookup.get(row.facility.hospcode)
          return quadrant ? QUADRANT_META[quadrant].label : 'ไม่มีข้อมูล'
        },
      },
    ]
  }, [quadrantData])

  // District (อำเภอ) aggregate — combines every facility type (รพ. + รพ.สต. + อื่นๆ) within
  // each district. Target: ≥30% combined.
  const districtTargets = useMemo(() => {
    const byDistrict = new Map<string, { ampName: string; count: number; totalOp: number; totalType5: number }>()
    for (const row of yearRows) {
      if (!row.stats) continue
      const key = row.facility.ampName
      const entry = byDistrict.get(key) ?? { ampName: key, count: 0, totalOp: 0, totalType5: 0 }
      entry.count += 1
      entry.totalOp += row.op
      entry.totalType5 += row.type5
      byDistrict.set(key, entry)
    }
    return Array.from(byDistrict.values())
      .map((entry) => ({
        ...entry,
        rate: entry.totalOp > 0 ? (entry.totalType5 / entry.totalOp) * 100 : null,
      }))
      .sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // รพ.สต. (sub-district health promoting hospital)-only aggregate. Target: ≥10%.
  const rpstSummary = useMemo(() => {
    let totalOp = 0
    let totalType5 = 0
    let count = 0
    for (const row of yearRows) {
      if (!row.stats) continue
      if (!row.facility.hostypeName.includes(RPST_HOSTYPE_MATCH)) continue
      count += 1
      totalOp += row.op
      totalType5 += row.type5
    }
    const rate = totalOp > 0 ? (totalType5 / totalOp) * 100 : null
    return { count, totalOp, totalType5, rate }
  }, [yearRows])

  const {
    sortedRows: sortedTableRows,
    sortKey,
    sortDir,
    toggleSort,
  } = useSortableTable(tableRows)

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel
        objective="เปรียบเทียบสถานบริการกับเกณฑ์มาตรฐานระดับประเทศ จัดกลุ่มเชิงกลยุทธ์ และคาดการณ์แนวโน้มการใช้บริการโทรเวชกรรม เพื่อสนับสนุนการตัดสินใจเชิงนโยบาย"
        methodology="อัตรา = Type5 (จำนวนครั้งโทรเวชกรรม) ÷ OP × 100 — สูตรเดียวกันกับที่ใช้ในแท็บภาพรวม/แยกประเภทบริการ เพื่อให้ตัวเลขอ่านง่ายและสอดคล้องกันทั้งระบบ เทียบกับเป้าหมาย 2 ระดับ: รายอำเภอ (รวม รพ.+รพ.สต. ในอำเภอนั้น) ไม่น้อยกว่าร้อยละ 30 และเฉพาะ รพ.สต. ไม่น้อยกว่าร้อยละ 10 — อ้างอิงเป้าหมายร้อยละ 30 จากเอกสาร SOP ของกระทรวงสาธารณสุข ส่วนเป้ารพ.สต. 10% และการแยกระดับอำเภอ/รพ.สต. เป็นเกณฑ์ที่ผู้ดูแลระบบกำหนดเพิ่มให้เหมาะกับการติดตามจริง การจัดกลุ่มเชิงกลยุทธ์ 4 ส่วน (Champions/Sleeping Giants/Active Small/Waiting for Support) แบ่งตามค่ามัธยฐาน (median) ของ OP และอัตราในกลุ่มสถานบริการที่กำลังดูอยู่ ส่วนสถานบริการที่มีอัตราเกิน 50% จะถูกตั้งข้อสังเกตให้ตรวจสอบความถูกต้องของข้อมูลใน HDC"
        source="ตาราง service (ระบบ Hippo) ผ่านข้อมูลหมวด 'แยกประเภทบริการ' (Type1-5) ร่วมกับข้อมูลสังกัด (MCODE/M_NAME) จากรายงานภาพรวม"
        template="ร่าง SOP ขับเคลื่อน Telemedicine, MOPH Telemedicine 2569 (นพ.วรเวทย์ โรจน์จรัสไพศาล, รองผู้อำนวยการสำนักสุขภาพดิจิทัล, 11 พ.ค. 2569) — เกณฑ์เป้าหมาย 30% อ้างอิงจากเอกสารนี้; กรอบวิเคราะห์ 4 ส่วน (quadrant) และการพยากรณ์ดัดแปลงจากการวิเคราะห์ส่วนตัวใน q_telemed_hosp_muk.ipynb"
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">วิเคราะห์เชิงกลยุทธ์</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ปีงบประมาณ</span>
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 p-1">
            {FISCAL_YEARS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setFiscalYear(year)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  fiscalYear === year
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">อัตรา Telemedicine ต่อ OP (ทั้งจังหวัด)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-800 dark:text-slate-100">
            {provinceKpis.aggregateRate === null ? 'ไม่มีข้อมูล' : `${provinceKpis.aggregateRate.toFixed(2)}%`}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            ตัวเลขรวมทั้งจังหวัด — ดูเทียบเป้าหมายรายอำเภอ/รพ.สต. ด้านล่าง
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">อัตราการเริ่มใช้งาน (Activation Rate)</p>
          <p className="mt-2 text-3xl font-semibold text-brand-600 dark:text-brand-400">
            {provinceKpis.activationRate === null ? '—' : `${provinceKpis.activationRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">สัดส่วนสถานบริการที่มี Type5 &gt; 0</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">จำนวนสถานบริการที่ควรตรวจสอบ</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600 dark:text-rose-400">{provinceKpis.anomalyCount}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">อัตราเกิน 50% (ควรตรวจสอบใน HDC)</p>
        </div>
      </div>

      {forecast && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:col-span-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">คาดการณ์ปีงบ 70 (ค่าประมาณ)</p>
            <p className="mt-2 text-3xl font-semibold text-brand-600 dark:text-brand-400">
              {forecast.projected.toLocaleString('th-TH')}
              <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">ครั้ง</span>
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ประมาณการแบบเส้นตรงจาก Type5: ปีงบ 68 = {forecast.total68.toLocaleString('th-TH')}, ปีงบ 69 ={' '}
              {forecast.total69.toLocaleString('th-TH')}
            </p>
          </div>
        </div>
      )}

      {/* Tiered targets: รพ.สต. ≥10%, district (รวม รพ.+รพ.สต.) ≥30% */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-slate-800 dark:text-slate-100">เป้าหมายตามระดับ (ปีงบ {fiscalYear})</h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          เป้าหมาย รพ.สต. ไม่น้อยกว่าร้อยละ {RPST_TARGET_RATE} · เป้าหมายรวมรายอำเภอ (รพ.+รพ.สต.) ไม่น้อยกว่าร้อยละ{' '}
          {DISTRICT_TARGET_RATE}
        </p>

        <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 sm:max-w-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">รพ.สต. ทั้งจังหวัด ({rpstSummary.count.toLocaleString('th-TH')} แห่ง)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {rpstSummary.rate === null ? 'ไม่มีข้อมูล' : `${rpstSummary.rate.toFixed(2)}%`}
          </p>
          {rpstSummary.rate !== null && (
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                rpstSummary.rate >= RPST_TARGET_RATE
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              {rpstSummary.rate >= RPST_TARGET_RATE
                ? 'ถึงเป้าหมายแล้ว'
                : `ขาดอีก ${(RPST_TARGET_RATE - rpstSummary.rate).toFixed(1)} จุด`}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 text-right font-medium">จำนวนหน่วย</th>
                <th className="px-3 py-2 text-right font-medium">OP รวม</th>
                <th className="px-3 py-2 text-right font-medium">Type5 รวม</th>
                <th className="px-3 py-2 text-right font-medium">อัตรา %</th>
                <th className="px-3 py-2 font-medium">เทียบเป้าหมาย {DISTRICT_TARGET_RATE}%</th>
              </tr>
            </thead>
            <tbody>
              {districtTargets.map((row) => (
                <tr key={row.ampName} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{row.ampName}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{row.count.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{row.totalOp.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2 text-right font-medium text-brand-700 dark:text-brand-400">
                    {row.totalType5.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.rate === null ? 'ไม่มีข้อมูล' : `${row.rate.toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2">
                    {row.rate === null ? (
                      '—'
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.rate >= DISTRICT_TARGET_RATE
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {row.rate >= DISTRICT_TARGET_RATE
                          ? 'ถึงเป้าหมายแล้ว'
                          : `ขาดอีก ${(DISTRICT_TARGET_RATE - row.rate).toFixed(1)} จุด`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {districtTargets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOPH vs LGO comparison */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          เปรียบเทียบตามสังกัด (ปีงบ {fiscalYear})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">สังกัด</th>
                <th className="px-3 py-2 text-right font-medium">จำนวนหน่วย</th>
                <th className="px-3 py-2 text-right font-medium">OP รวม</th>
                <th className="px-3 py-2 text-right font-medium">Telemedicine รวม (Type5)</th>
                <th className="px-3 py-2 text-right font-medium">อัตราตามเกณฑ์ สธ. %</th>
              </tr>
            </thead>
            <tbody>
              {affiliationComparison.map((row) => (
                <tr key={row.mName} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{row.mName}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{row.count.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.totalOp.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-brand-700 dark:text-brand-400">
                    {row.totalType5.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.rate === null ? '—' : `${row.rate.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
              {affiliationComparison.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4" style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart
              data={affiliationComparison.map((r) => ({ mName: r.mName, rate: r.rate ?? 0 }))}
              margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="mName"
                angle={-20}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 12, fill: '#475569' }}
              />
              <YAxis tick={{ fontSize: 12, fill: '#475569' }} unit="%" />
              <Tooltip
                formatter={(value) => `${Number(value ?? 0).toFixed(2)}%`}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rate" name="อัตราตามเกณฑ์ สธ. %" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4-quadrant strategic segmentation */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          การจัดกลุ่มเชิงกลยุทธ์ 4 ส่วน (ปีงบ {fiscalYear})
        </h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          แบ่งตามค่ามัธยฐาน OP ({quadrantData.medianOp.toLocaleString('th-TH')}) และอัตราตามเกณฑ์ สธ. (
          {quadrantData.medianRate.toFixed(2)}%) เฉพาะสถานบริการที่มีข้อมูลอัตรา (ไม่รวมสถานบริการที่ไม่มีข้อมูล)
        </p>
        <div style={{ width: '100%', height: 420 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="op"
                name="OP"
                tick={{ fontSize: 12, fill: '#475569' }}
                label={{ value: 'OP', position: 'insideBottom', offset: -4, fontSize: 12, fill: '#475569' }}
              />
              <YAxis
                type="number"
                dataKey="rate"
                name="อัตรา %"
                unit="%"
                tick={{ fontSize: 12, fill: '#475569' }}
                label={{ value: 'อัตรา %', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#475569' }}
              />
              <ZAxis range={[60, 60]} />
              <ReferenceLine x={quadrantData.medianOp} stroke="#94a3b8" strokeDasharray="4 4" />
              <ReferenceLine y={quadrantData.medianRate} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, key) => (key === 'rate' ? `${Number(value).toFixed(2)}%` : value)}
                labelFormatter={() => ''}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {scatterSeries.map((series) => (
                <Scatter key={series.quadrant} name={series.label} data={series.points} fill={series.color} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(QUADRANT_META) as Quadrant[]).map((quadrant) => {
            const rows = quadrantData.groups[quadrant]
            return (
              <div key={quadrant} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                <p className="text-sm font-semibold" style={{ color: QUADRANT_META[quadrant].color }}>
                  {QUADRANT_META[quadrant].label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{rows.length}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">สถานบริการ</p>
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
                  {rows.map((row) => (
                    <li key={row.facility.hospcode} className="truncate py-0.5">
                      {row.facility.hospname}
                    </li>
                  ))}
                  {rows.length === 0 && <li className="py-0.5 text-slate-400 dark:text-slate-500">ไม่มี</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Anomaly review table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          สถานบริการที่ควรตรวจสอบ (อัตราเกิน 50%, ปีงบ {fiscalYear})
        </h3>
        {anomalyRows.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-500">ไม่พบสถานบริการที่ควรตรวจสอบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                  <th className="px-3 py-2 font-medium">อำเภอ</th>
                  <th className="px-3 py-2 font-medium">สังกัด</th>
                  <th className="px-3 py-2 text-right font-medium">Type5</th>
                  <th className="px-3 py-2 text-right font-medium">OP</th>
                  <th className="px-3 py-2 text-right font-medium">อัตรา %</th>
                  <th className="px-3 py-2 font-medium">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {anomalyRows.map((row) => (
                  <tr key={row.facility.hospcode} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{row.facility.hospname}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.facility.ampName}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.facility.mName}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{row.type5.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                      {row.denominator.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-rose-600 dark:text-rose-400">
                      {(row.rate ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-rose-600 dark:text-rose-400">ควรตรวจสอบใน HDC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filterable facility table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`วิเคราะห์เชิงกลยุทธ์_${allSnapshot.snapshotDate}`}
              title={`วิเคราะห์เชิงกลยุทธ์ (ปีงบ ${fiscalYear}) — ${allSnapshot.snapshotDate}`}
              columns={exportColumns}
              rows={tableRows}
            />
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              value={hostype}
              onChange={(e) => setHostype(e.target.value)}
            >
              <option value={ALL_HOSTYPES}>ประเภทสถานบริการ: ทั้งหมด</option>
              {hostypeOptions.map((ht) => (
                <option key={ht} value={ht}>
                  {ht}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="ค้นหาชื่อสถานพยาบาล รหัสสถาน หรืออำเภอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <SortableTh
                  label="รหัสสถาน"
                  active={sortKey === 'hospcode'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospcode', (row) => row.facility.hospcode)}
                  className="px-3 py-2 font-medium"
                />
                <SortableTh
                  label="สถานพยาบาล"
                  active={sortKey === 'hospname'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospname', (row) => row.facility.hospname)}
                  className="px-3 py-2 font-medium"
                />
                <SortableTh
                  label="อำเภอ"
                  active={sortKey === 'ampName'}
                  direction={sortDir}
                  onClick={() => toggleSort('ampName', (row) => row.facility.ampName)}
                  className="px-3 py-2 font-medium"
                />
                <SortableTh
                  label="สังกัด"
                  active={sortKey === 'mName'}
                  direction={sortDir}
                  onClick={() => toggleSort('mName', (row) => row.facility.mName)}
                  className="px-3 py-2 font-medium"
                />
                <SortableTh
                  label="ประเภท"
                  active={sortKey === 'hostypeName'}
                  direction={sortDir}
                  onClick={() => toggleSort('hostypeName', (row) => row.facility.hostypeName)}
                  className="px-3 py-2 font-medium"
                />
                <SortableTh
                  label="OP"
                  align="right"
                  active={sortKey === 'op'}
                  direction={sortDir}
                  onClick={() => toggleSort('op', (row) => row.op)}
                  className="px-3 py-2 text-right font-medium"
                />
                <SortableTh
                  label="Type5 (Telemedicine)"
                  align="right"
                  active={sortKey === 'type5'}
                  direction={sortDir}
                  onClick={() => toggleSort('type5', (row) => row.type5)}
                  className="px-3 py-2 text-right font-medium"
                />
                <SortableTh
                  label="อัตราตามเกณฑ์ สธ. %"
                  align="right"
                  active={sortKey === 'rate'}
                  direction={sortDir}
                  onClick={() => toggleSort('rate', (row) => row.rate ?? -1)}
                  className="px-3 py-2 text-right font-medium"
                />
                <SortableTh
                  label="กลุ่มเชิงกลยุทธ์"
                  active={sortKey === 'quadrant'}
                  direction={sortDir}
                  onClick={() =>
                    toggleSort('quadrant', (row) => {
                      const quadrant = quadrantData.lookup.get(row.facility.hospcode)
                      return quadrant ? QUADRANT_META[quadrant].label : 'ไม่มีข้อมูล'
                    })
                  }
                  className="px-3 py-2 font-medium"
                />
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.map((row) => {
                const quadrant = quadrantData.lookup.get(row.facility.hospcode)
                return (
                  <tr key={row.facility.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{row.facility.hospcode}</td>
                    <td className="px-3 py-2 text-slate-800">{row.facility.hospname}</td>
                    <td className="px-3 py-2 text-slate-600">{row.facility.ampName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.facility.mName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.facility.hostypeName}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.op.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right font-medium text-brand-700">
                      {row.type5.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {row.rate === null ? 'ไม่มีข้อมูล' : `${row.rate.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {quadrant ? QUADRANT_META[quadrant].label : 'ไม่มีข้อมูล'}
                    </td>
                  </tr>
                )
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                    ไม่พบสถานพยาบาลที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Insights & Recommendations */}
      <div className="rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 shadow-md">
        <h3 className="mb-6 text-lg font-bold text-cyan-700">🎯 การวิเคราะห์เชิงกลยุทธ์ & ข้อเสนอแนะ</h3>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Goals Summary */}
          <div className="rounded-xl bg-white/70 p-5 border-l-4 border-cyan-500">
            <h4 className="font-bold text-cyan-700 mb-4">📊 สรุปเป้าหมาย</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">เป้าหมายจังหวัด (≥30%):</span>
                <span className="font-bold text-lg">
                  {((districtTargets.filter(d => d.rate !== null && d.rate >= DISTRICT_TARGET_RATE).length / Math.max(districtTargets.length, 1)) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">เป้าหมายรพสต. (≥10%):</span>
                <span className="font-bold text-lg">
                  {((filteredFacilities.filter(f => {
                    if (!f.hostypeName.includes(RPST_HOSTYPE_MATCH)) return false
                    const rate = officialRate(f.byYear[fiscalYear])
                    return rate !== null && rate >= RPST_TARGET_RATE
                  }).length / Math.max(filteredFacilities.filter(f => f.hostypeName.includes(RPST_HOSTYPE_MATCH)).length, 1)) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Champions:</span>
                <span className="font-bold text-teal-600">{quadrantData.groups.champions.length} หน่วย</span>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="rounded-xl bg-white/70 p-5 border-l-4 border-emerald-500">
            <h4 className="font-bold text-emerald-700 mb-4">💡 ข้อสังเกต</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <p>✓ {quadrantData.groups.champions.length} สถานบริการดำเนินงานได้เก่ง (Champions)</p>
              <p>⚠️ {quadrantData.groups.sleepingGiants.length} สถานบริการมีศักยภาพสูง (Sleeping Giants)</p>
              <p>💪 {quadrantData.groups.activeSmall.length} สถานบริการจิ๋วแต่แจ๋ว (Active Small)</p>
              <p>📞 {quadrantData.groups.waitingForSupport.length} สถานบริการรอการสนับสนุน (Support)</p>
            </div>
          </div>
        </div>

        {/* Strategic Recommendations */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 border-l-4 border-emerald-500">
            <p className="font-bold text-emerald-700">🏆 Champions</p>
            <p className="text-xs text-slate-600 mt-2">ให้เป็นต้นแบบในการสอนงาน ขยายสถาบันและเครือข่าย</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-4 border-l-4 border-amber-500">
            <p className="font-bold text-amber-700">📈 Giants</p>
            <p className="text-xs text-slate-600 mt-2">กระตุ้นด้วยเทคโนโลยี ป้องกัน HR ลงลึก</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border-l-4 border-blue-500">
            <p className="font-bold text-blue-700">⚡ Active</p>
            <p className="text-xs text-slate-600 mt-2">เพิ่มปริมาณ OP ขยายภูมิศาสตร์</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 p-4 border-l-4 border-slate-500">
            <p className="font-bold text-slate-700">🤝 Support</p>
            <p className="text-xs text-slate-600 mt-2">ฝึกอบรม ระบบ สื่อสาร HR</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StrategicAnalysisView
