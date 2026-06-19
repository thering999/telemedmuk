import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Facility, FiscalYear, Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { FISCAL_YEARS, telemedVisits } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import type { ExportColumn } from '../lib/exportTable'
import { CHART_COLORS, COLORS } from '../lib/designSystem'
import ReportInfoPanel, { type ReportInfoPanelProps } from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'

const ALL_DISTRICTS = '__all__'
const ALL_FACILITIES = '__all__'
const ALL_HOSTYPES = '__all__'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

const DEFAULT_DOCS: ReportInfoPanelProps = {
  objective:
    "เกณฑ์หลักของรายงานนี้คือ 'OP68 เทียบ Telemed69' — เทียบจำนวนผู้รับบริการ OP ทั้งหมดในปีงบ 68 (ฐานงานเดิม) กับจำนวนผู้ใช้บริการโทรเวชกรรมในปีงบ 69 (ปีปัจจุบัน) ของแต่ละสถานบริการในจังหวัดมุกดาหาร นอกจากนี้ยังมีมุมมองเสริมที่เทียบ OP และ Telemedicine ในปีงบเดียวกัน (สลับดูได้ทั้งปีงบ 68/69 ด้วยปุ่มด้านบน) สำหรับติดตามแนวโน้มปีต่อปี",
  methodology:
    "เกณฑ์หลัก OP68→Telemed69 มาจากสูตรดั้งเดิมในข้อมูลต้นทาง (คอลัมน์ PercentTelemed69PerOP68) คำนวณแบบรวมก่อนหารเสมอ (sum(Telemed69) ÷ sum(OP68)) ไม่ใช่ค่าเฉลี่ยของร้อยละรายสถานบริการ — ส่วนมุมมองเสริม (ปีงบเดียวกัน) รองรับไฟล์ส่งออก 2 รูปแบบที่ใช้ร่วมกันได้จากสูตรเดียวกัน (q_telemed_hosp_muk.ipynb): ไฟล์ที่แยกย่อย Type2 (นัดหมาย/ส่งต่อ) + Type3 (เชิงรุก/ชุมชน) + Type5 (โทรเวชกรรม) เป็น 'Telemed', และไฟล์ที่มีผลรวม Telemed สำเร็จรูปอยู่แล้ว ข้อมูลกรอกมือ (typein) แยกไว้เป็นรายงานต่างหาก (ดูแท็บ 'ข้อมูลเกณฑ์จาก PH-EOC') เนื่องจากใช้สูตรคำนวณคนละแบบ (จากสมุดบันทึก q_telemed_hosp-235.ipynb) เพื่อไม่ให้ตัวเลขสองสูตรปนกันในตารางเดียว",
  source: 'ตาราง service (ระบบ Hippo) ร่วมกับตารางอ้างอิงระดับประเทศ icd10_chk_op เพื่อกรองเฉพาะการรับบริการที่นับเป็น OP ที่ถูกต้อง (valid=\'T\' และ OP_PP=\'OP\')',
  template: 'q_telemed_hosp_muk.ipynb (ตัวอย่าง Ad Hoc)',
}

export interface SnapshotViewProps {
  snapshot: Snapshot
  /**
   * Optional: the full snapshot index, used only to power the "telemed
   * visits over time" line chart across multiple snapshots. When omitted
   * (e.g. for an ad hoc uploaded file that has no index), the line chart
   * section is skipped entirely.
   */
  snapshotIndex?: SnapshotIndexEntry[]
  /**
   * Optional: override the ReportInfoPanel content. Defaults to the
   * "ภาพรวม" (base category) explanation. Used by HdcTab to reuse this same
   * component for the "ข้อมูลกรอกมือ" (typein, separate formula) sub-tab with
   * different documentation text.
   */
  docs?: ReportInfoPanelProps
}

function SnapshotView({ snapshot, snapshotIndex, docs = DEFAULT_DOCS }: SnapshotViewProps) {
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState<string>(ALL_DISTRICTS)
  const [hostype, setHostype] = useState<string>(ALL_HOSTYPES)
  const [facilityCode, setFacilityCode] = useState<string>(ALL_FACILITIES)

  // Detect if this is a typein (PH-EOC) report
  const isTypeinReport = docs.template === 'q_telemed_hosp-235.ipynb'
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')

  // Reset the filters whenever the snapshot itself changes (new data
  // loaded), without an extra effect-driven render: adjust state during
  // render per React's "you might not need an effect" guidance, tracking
  // the previous snapshot to detect the change.
  const [prevSnapshot, setPrevSnapshot] = useState(snapshot)
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot)
    setDistrict(ALL_DISTRICTS)
    setHostype(ALL_HOSTYPES)
    setFacilityCode(ALL_FACILITIES)
    setSearch('')
  }

  const districtOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of snapshot.facilities) set.add(f.ampName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [snapshot])

  const hostypeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of snapshot.facilities) set.add(f.hostypeName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [snapshot])

  const facilityOptions = useMemo(() => {
    return snapshot.facilities
      .filter((f) => district === ALL_DISTRICTS || f.ampName === district)
      .filter((f) => hostype === ALL_HOSTYPES || f.hostypeName === hostype)
      .slice()
      .sort((a, b) => a.hospcode.localeCompare(b.hospcode))
  }, [snapshot, district, hostype])

  // If the currently-selected facility falls out of the cascaded options
  // (district changed to one that doesn't contain it), treat the selection
  // as cleared. Derived during render instead of via a state-correcting
  // effect — the select's value simply falls back to "ทั้งหมด" until the
  // user picks something in-range again.
  const effectiveFacilityCode = useMemo(() => {
    if (facilityCode === ALL_FACILITIES) return ALL_FACILITIES
    return facilityOptions.some((f) => f.hospcode === facilityCode)
      ? facilityCode
      : ALL_FACILITIES
  }, [facilityOptions, facilityCode])

  const filteredFacilities = useMemo<Facility[]>(() => {
    const q = search.trim().toLowerCase()
    return snapshot.facilities.filter((f) => {
      if (district !== ALL_DISTRICTS && f.ampName !== district) return false
      if (hostype !== ALL_HOSTYPES && f.hostypeName !== hostype) return false
      if (effectiveFacilityCode !== ALL_FACILITIES && f.hospcode !== effectiveFacilityCode) return false
      if (q) {
        const matches =
          f.hospname.toLowerCase().includes(q) ||
          f.ampName.toLowerCase().includes(q) ||
          f.hospcode.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [snapshot, district, hostype, effectiveFacilityCode, search])

  const selectedFacility = useMemo(
    () =>
      effectiveFacilityCode === ALL_FACILITIES
        ? null
        : snapshot.facilities.find((f) => f.hospcode === effectiveFacilityCode) ?? null,
    [snapshot, effectiveFacilityCode],
  )

  // Base metric: OP68 เทียบ Telemed69 (for base report) or OP69 เทียบ Telemed69 (for typein)
  const baseMetricKpis = useMemo(() => {
    let totalOp = 0
    let totalTelemed69 = 0
    for (const f of filteredFacilities) {
      if (isTypeinReport) {
        // PH-EOC: OP69 (Service69) vs Telemed69
        totalOp += f.byYear['69']?.op ?? 0
      } else {
        // Base: OP68 vs Telemed69
        totalOp += f.byYear['68']?.op ?? 0
      }
      totalTelemed69 += telemedVisits(f.byYear['69'])
    }
    const percent = totalOp > 0 ? (totalTelemed69 / totalOp) * 100 : 0
    return { totalOp, totalTelemed: totalTelemed69, percent }
  }, [filteredFacilities, isTypeinReport])

  // Supplementary metric: Year-flexible comparison (affected by fiscal year toggle)
  const kpis = useMemo(() => {
    let totalOp = 0
    let totalTelemed = 0
    for (const f of filteredFacilities) {
      const stats = f.byYear[fiscalYear]
      totalOp += stats?.op ?? 0
      totalTelemed += telemedVisits(stats)
    }
    const percent = totalOp > 0 ? (totalTelemed / totalOp) * 100 : 0
    return { totalOp, totalTelemed, percent }
  }, [filteredFacilities, fiscalYear])

  const districtChartData = useMemo(() => {
    const byDistrict = new Map<string, number>()
    for (const f of filteredFacilities) {
      const visits = telemedVisits(f.byYear[fiscalYear])
      byDistrict.set(f.ampName, (byDistrict.get(f.ampName) ?? 0) + visits)
    }
    return Array.from(byDistrict.entries())
      .map(([ampName, telemed]) => ({ ampName, telemed }))
      .sort((a, b) => b.telemed - a.telemed)
  }, [filteredFacilities, fiscalYear])

  // When a single facility is selected, the "by district" bar chart is not
  // meaningful (it would show just one bar). Swap it for a breakdown of that
  // facility's own service-type composition (Type2 / Type3 / Type5) instead.
  // Only meaningful when the selected facility's selected-year stats
  // actually carry a type-level breakdown (Format A) — Format B/C facilities
  // have no type2/type3/type5 at all for that year.
  const selectedFacilityHasTypeBreakdown = useMemo(() => {
    if (!selectedFacility) return false
    const stats = selectedFacility.byYear[fiscalYear]
    return stats?.type2 !== undefined || stats?.type3 !== undefined || stats?.type5 !== undefined
  }, [selectedFacility, fiscalYear])

  const facilityTypeChartData = useMemo(() => {
    if (!selectedFacility || !selectedFacilityHasTypeBreakdown) return []
    const stats = selectedFacility.byYear[fiscalYear]
    return [
      { type: 'Type2', value: stats?.type2 ?? 0 },
      { type: 'Type3', value: stats?.type3 ?? 0 },
      { type: 'Type5', value: stats?.type5 ?? 0 },
    ]
  }, [selectedFacility, fiscalYear, selectedFacilityHasTypeBreakdown])

  // Only facilities whose selected-year stats actually carry a type-level
  // breakdown (Format A) can contribute to this chart — Format B/C facilities
  // have no type2/type3/type5 at all for that year.
  const hasTypeBreakdownData = useMemo(() => {
    return filteredFacilities.some((f) => {
      const stats = f.byYear[fiscalYear]
      return stats?.type2 !== undefined || stats?.type3 !== undefined || stats?.type5 !== undefined
    })
  }, [filteredFacilities, fiscalYear])

  const pieChartData = useMemo(() => {
    if (!hasTypeBreakdownData) return []
    let type2 = 0
    let type3 = 0
    let type5 = 0
    for (const f of filteredFacilities) {
      const stats = f.byYear[fiscalYear]
      type2 += stats?.type2 ?? 0
      type3 += stats?.type3 ?? 0
      type5 += stats?.type5 ?? 0
    }
    return [
      { type: 'Type2', value: type2 },
      { type: 'Type3', value: type3 },
      { type: 'Type5', value: type5 },
    ].filter((d) => d.value > 0)
  }, [filteredFacilities, fiscalYear, hasTypeBreakdownData])

  // Optional multi-snapshot trend line: only meaningful when there is more
  // than one snapshot available in the index. Fetches the other snapshots
  // lazily and degrades gracefully (friendly message) when there's only one.
  const [trendState, setTrendState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; points: { date: string; telemed: number }[] }
  >({ status: 'idle' })

  const otherDates = useMemo(() => {
    if (!snapshotIndex || snapshotIndex.length <= 1) return []
    return snapshotIndex.map((e) => e.date).filter((d) => d !== snapshot.snapshotDate)
  }, [snapshotIndex, snapshot.snapshotDate])

  const showTrendChart = Boolean(snapshotIndex && snapshotIndex.length > 1)

  useEffect(() => {
    if (!showTrendChart) return

    let cancelled = false
    // Defer the "loading" transition to a microtask so it's not a
    // synchronous setState call in the effect body (avoids cascading
    // renders flagged by react-hooks/set-state-in-effect) while still
    // showing a loading state almost immediately.
    Promise.resolve().then(() => {
      if (!cancelled) setTrendState({ status: 'loading' })
    })

    const computeTelemedFor = (s: Snapshot) => {
      let total = 0
      for (const f of s.facilities) {
        if (district !== ALL_DISTRICTS && f.ampName !== district) continue
        if (hostype !== ALL_HOSTYPES && f.hostypeName !== hostype) continue
        if (effectiveFacilityCode !== ALL_FACILITIES && f.hospcode !== effectiveFacilityCode) continue
        total += telemedVisits(f.byYear[fiscalYear])
      }
      return total
    }

    Promise.all(
      otherDates.map((date) =>
        fetch(dataUrl(`${date}.json`))
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json() as Promise<Snapshot>
          })
          .then((s) => ({ date, telemed: computeTelemedFor(s) })),
      ),
    )
      .then((others) => {
        if (cancelled) return
        const points = [
          ...others,
          { date: snapshot.snapshotDate, telemed: computeTelemedFor(snapshot) },
        ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        setTrendState({ status: 'ready', points })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setTrendState({
          status: 'error',
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลแนวโน้มได้',
        })
      })

    return () => {
      cancelled = true
    }
  }, [showTrendChart, otherDates, snapshot, district, hostype, effectiveFacilityCode, fiscalYear])

  const exportColumns = useMemo<ExportColumn<Facility>[]>(() => {
    return [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
      { key: 'op', label: `OP รวม (ปีงบ ${fiscalYear})`, value: (f) => f.byYear[fiscalYear]?.op ?? 0 },
      { key: 'type2', label: 'Type2', value: (f) => f.byYear[fiscalYear]?.type2 ?? 0 },
      { key: 'type3', label: 'Type3', value: (f) => f.byYear[fiscalYear]?.type3 ?? 0 },
      { key: 'type5', label: 'Type5', value: (f) => f.byYear[fiscalYear]?.type5 ?? 0 },
      { key: 'telemed', label: 'รวม Telemedicine', value: (f) => telemedVisits(f.byYear[fiscalYear]) },
      {
        key: 'percent',
        label: 'ร้อยละ',
        value: (f) => {
          const stats = f.byYear[fiscalYear]
          const op = stats?.op ?? 0
          return op > 0 ? Number(((telemedVisits(stats) / op) * 100).toFixed(2)) : 0
        },
      },
    ]
  }, [fiscalYear])

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel {...docs} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <span>📊 ข้อมูล: {filteredFacilities.length} สถานบริการ</span>
        <span>•</span>
        <span>📅 ปีงบ {fiscalYear}</span>
        <span>•</span>
        {(() => {
          const totalRecords = filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.op ?? 0), 0);
          return <span>👥 {totalRecords.toLocaleString('th-TH')} รายการ</span>;
        })()}
        <span className="ml-auto">
          {filteredFacilities.length === snapshot.facilities.length
            ? '✅ ไม่มีตัวกรอง'
            : `🔍 ${snapshot.facilities.length - filteredFacilities.length} รายการถูกซ่อน`}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 px-5 py-4 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex flex-col gap-1">
          <label htmlFor="district-select" className="text-sm font-medium text-slate-600">
            อำเภอ
          </label>
          <select
            id="district-select"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value={ALL_DISTRICTS}>ทั้งหมด</option>
            {districtOptions.map((amp) => (
              <option key={amp} value={amp}>
                {amp}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="hostype-select" className="text-sm font-medium text-slate-600">
            ประเภทสถานบริการ
          </label>
          <select
            id="hostype-select"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={hostype}
            onChange={(e) => setHostype(e.target.value)}
          >
            <option value={ALL_HOSTYPES}>ทั้งหมด</option>
            {hostypeOptions.map((ht) => (
              <option key={ht} value={ht}>
                {ht}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="facility-select" className="text-sm font-medium text-slate-600">
            หน่วยบริการ / รหัสสถาน
          </label>
          <select
            id="facility-select"
            className="max-w-[20rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={effectiveFacilityCode}
            onChange={(e) => setFacilityCode(e.target.value)}
          >
            <option value={ALL_FACILITIES}>ทั้งหมด</option>
            {facilityOptions.map((f) => (
              <option key={f.hospcode} value={f.hospcode}>
                {f.hospcode} - {f.hospname}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">ปีงบประมาณ</span>
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
            {FISCAL_YEARS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setFiscalYear(year)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  fiscalYear === year
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={isTypeinReport ? "OP รวม (ปีงบ 69)" : "OP รวม (ปีงบ 68)"}
          value={baseMetricKpis.totalOp.toLocaleString('th-TH')}
          description="เกณฑ์หลัก"
        />
        <KpiCard
          label="ผู้รับบริการ Telemedicine รวม (ปีงบ 69)"
          value={baseMetricKpis.totalTelemed.toLocaleString('th-TH')}
          description="เกณฑ์หลัก"
        />
        <KpiCard
          label={isTypeinReport ? "เกณฑ์ OP69 เทียบ Telemed69" : "เกณฑ์ OP68 เทียบ Telemed69"}
          value={`${baseMetricKpis.percent.toFixed(1)}%`}
          accent
          description="หลัก"
        />
      </div>


      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-5 py-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">📊 เป้าหมายและความก้าวหน้า</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(() => {
            const primaryCare = filteredFacilities.filter(f => f.hostypeName.includes('ส่งเสริมสุขภาพตำบล'));
            const primaryCareOP = primaryCare.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.op ?? 0), 0);
            const primaryCareTelemed = primaryCare.reduce((sum, f) => sum + telemedVisits(f.byYear[fiscalYear]), 0);
            const primaryCarePercent = primaryCareOP > 0 ? (primaryCareTelemed / primaryCareOP) * 100 : 0;
            const primaryCareGoal = 10;
            const primaryCareStatus = primaryCarePercent >= primaryCareGoal;
            const primaryCareProgress = Math.min(100, (primaryCarePercent / primaryCareGoal) * 100);

            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-blue-900">รพสต. (Primary Care)</p>
                  <p className="text-sm font-bold text-blue-700">{primaryCarePercent.toFixed(1)}%</p>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-blue-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      primaryCareStatus ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${primaryCareProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-blue-600">เป้าหมาย: {primaryCareGoal}% {primaryCareStatus ? '✅' : '⚠️'}</p>
              </div>
            );
          })()}

          {(() => {
            const districtGoal = 30;
            const currentPercent = kpis.percent;
            const districtStatus = currentPercent >= districtGoal;
            const districtProgress = Math.min(100, (currentPercent / districtGoal) * 100);

            return (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-emerald-900">อำเภอ (District Avg)</p>
                  <p className="text-sm font-bold text-emerald-700">{currentPercent.toFixed(1)}%</p>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-emerald-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      districtStatus ? 'bg-emerald-600' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${districtProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-emerald-600">เป้าหมาย: {districtGoal}% {districtStatus ? '✅' : '⚠️'}</p>
              </div>
            );
          })()}

          {(() => {
            const allFacilities = snapshot.facilities;
            const allOP = allFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.op ?? 0), 0);
            const allTelemed = allFacilities.reduce((sum, f) => sum + telemedVisits(f.byYear[fiscalYear]), 0);
            const allPercent = allOP > 0 ? (allTelemed / allOP) * 100 : 0;
            const provinceProgress = Math.min(100, (allPercent / 20) * 100); // Assume 20% is aspirational for province

            return (
              <div className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">จังหวัดรวม (Province)</p>
                  <p className="text-sm font-bold text-slate-800">{allPercent.toFixed(1)}%</p>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-300">
                  <div
                    className="h-full rounded-full bg-slate-600 transition-all"
                    style={{ width: `${provinceProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-600">{allFacilities.length} สถานบริการ</p>
              </div>
            );
          })()}
        </div>
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedFacility ? (
            <>
              <h3 className="mb-4 text-base font-semibold text-slate-800">
                จำนวนผู้รับบริการ Telemedicine แยกตามประเภทบริการ — {selectedFacility.hospname} (ปีงบ{' '}
                {fiscalYear})
              </h3>
              {selectedFacilityHasTypeBreakdown ? (
                <div style={{ width: '100%', height: 360 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={facilityTypeChartData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                      <Tooltip
                        formatter={(value) => Number(value ?? 0).toLocaleString('th-TH')}
                        contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                      />
                      <Bar dataKey="value" name="ผู้รับบริการ Telemedicine" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="flex h-[360px] items-center justify-center text-center text-slate-400">
                  ไม่มีข้อมูลแยกประเภทบริการสำหรับชุดข้อมูลนี้
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-4 text-base font-semibold text-slate-800">
                จำนวนผู้รับบริการ Telemedicine แยกตามอำเภอ (ปีงบ {fiscalYear})
              </h3>
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={districtChartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="ampName"
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      tick={{ fontSize: 12, fill: '#475569' }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip
                      formatter={(value) =>
                        Array.isArray(value) ? value.join(', ') : Number(value ?? 0).toLocaleString('th-TH')
                      }
                      contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                    />
                    <Bar dataKey="telemed" name="ผู้รับบริการ Telemedicine" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">
            สัดส่วนผู้รับบริการ Telemedicine แยกตามประเภทบริการ (ปีงบ {fiscalYear})
          </h3>
          {!hasTypeBreakdownData ? (
            <p className="flex h-[360px] items-center justify-center text-center text-slate-400">
              ไม่มีข้อมูลแยกประเภทบริการสำหรับชุดข้อมูลนี้
            </p>
          ) : pieChartData.length > 0 ? (
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="type"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={2}
                    label={(props: { type?: string; value?: number }) =>
                      `${props.type}: ${Number(props.value ?? 0).toLocaleString('th-TH')}`
                    }
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={entry.type} fill={CHART_COLORS.pie[index % CHART_COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => Number(value ?? 0).toLocaleString('th-TH')} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="flex h-[360px] items-center justify-center text-center text-slate-400">
              ไม่มีข้อมูล Telemedicine สำหรับเงื่อนไขที่เลือก
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          แนวโน้มผู้รับบริการ Telemedicine ตามช่วงเวลา (ปีงบ {fiscalYear})
        </h3>
        {!showTrendChart && (
          <p className="flex h-[200px] items-center justify-center text-center text-slate-400">
            ต้องมีข้อมูลมากกว่า 1 ช่วงเวลาเพื่อแสดงกราฟนี้
          </p>
        )}
        {showTrendChart && trendState.status === 'loading' && (
          <p className="flex h-[200px] items-center justify-center text-center text-slate-400">
            กำลังโหลดข้อมูลแนวโน้ม...
          </p>
        )}
        {showTrendChart && trendState.status === 'error' && (
          <p className="flex h-[200px] items-center justify-center text-center text-rose-600">
            เกิดข้อผิดพลาดในการโหลดข้อมูลแนวโน้ม: {trendState.message}
          </p>
        )}
        {showTrendChart && trendState.status === 'ready' && (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={trendState.points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => formatThaiDate(d)}
                  tick={{ fontSize: 12, fill: '#475569' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  labelFormatter={(d) => formatThaiDate(String(d ?? ''))}
                  formatter={(value) => Number(value ?? 0).toLocaleString('th-TH')}
                  contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                />
                <Line
                  type="monotone"
                  dataKey="telemed"
                  name="ผู้รับบริการ Telemedicine"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-amber-900">🎯 สถานบริการที่มีผลกระทบสูงต่อเป้าหมาย</h3>
        <p className="mb-3 text-xs text-amber-800">
          สถานบริการที่มีปริมาณผู้รับบริการ (OP) มากที่สุด เพื่อเป้าหมายการเพิ่มการใช้ Telemedicine ของจังหวัด
        </p>
        <div className="overflow-hidden rounded-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-amber-200 bg-amber-100 text-amber-900">
                <th className="px-3 py-2 font-medium">ลำดับ</th>
                <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 text-right font-medium">OP</th>
                <th className="px-3 py-2 text-right font-medium">ร้อยละ</th>
                <th className="px-3 py-2 text-right font-medium">ต้องเพิ่มถึง 5%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 bg-white">
              {(() => {
                const highImpact = filteredFacilities
                  .map((f) => {
                    const stats = f.byYear[fiscalYear];
                    const op = stats?.op ?? 0;
                    const telemed = telemedVisits(stats);
                    const percent = op > 0 ? (telemed / op) * 100 : 0;
                    const needed = Math.max(0, (op * 0.05) - telemed);
                    return { f, op, telemed, percent, needed };
                  })
                  .sort((a, b) => b.op - a.op)
                  .slice(0, 10);

                return highImpact.map((item, idx) => (
                  <tr key={item.f.hospcode} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                    <td className="px-3 py-2 font-medium">{idx + 1}</td>
                    <td className="px-3 py-2">{item.f.hospcode}</td>
                    <td className="px-3 py-2">{item.f.hospname}</td>
                    <td className="px-3 py-2">{item.f.ampName}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.op.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right">{item.percent.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">
                      <span className={item.needed > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700'}>
                        {item.needed > 0 ? `+${Math.ceil(item.needed)}` : '✓'}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`ภาพรวม_${snapshot.snapshotDate}`}
              title={`ภาพรวม โทรเวชกรรม จ.มุกดาหาร (ปีงบ ${fiscalYear}) — ${snapshot.snapshotDate}`}
              columns={exportColumns}
              rows={filteredFacilities}
            />
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-slate-700">
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">รหัสสถาน</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">สถานพยาบาล</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">อำเภอ</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">ประเภท</th>
                {isTypeinReport ? (
                  <>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">OP69</th>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">Telemed69</th>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">ร้อยละ</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">OP68</th>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">Telemed69</th>
                    <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">ร้อยละ</th>
                  </>
                )}
                <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => {
                const percent = isTypeinReport ? f.percentTelemed69PerOP68 : f.percentTelemed69PerOP68
                return (
                  <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-sm font-mono">{f.hospcode}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{f.hospname}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{f.ampName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="text-xs">
                        {f.hostypeName.includes('ส่งเสริมสุขภาพตำบล') ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 font-medium">รพสต.</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 font-medium">รพ.</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {isTypeinReport
                        ? (f.byYear['69']?.op ?? 0).toLocaleString('th-TH')
                        : (f.byYear['68']?.op ?? 0).toLocaleString('th-TH')
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {telemedVisits(f.byYear['69']).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-brand-700">{percent.toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      {percent >= 5 ? (
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">✓ ดี</span>
                      ) : percent >= 2 ? (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">≈ ปานกลาง</span>
                      ) : (
                        <span className="inline-block rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">! ต้องปรับปรุง</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                    ไม่พบสถานพยาบาลที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
              {filteredFacilities.length > 0 && (
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                  <td className="px-3 py-3">รวม</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities
                      .reduce(
                        (sum, f) =>
                          sum +
                          (isTypeinReport ? f.byYear['69']?.op ?? 0 : f.byYear['68']?.op ?? 0),
                        0,
                      )
                      .toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + telemedVisits(f.byYear['69']), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-700">
                    {(() => {
                      const totalOp = filteredFacilities.reduce(
                        (sum, f) =>
                          sum +
                          (isTypeinReport ? f.byYear['69']?.op ?? 0 : f.byYear['68']?.op ?? 0),
                        0,
                      )
                      const totalTelemed = filteredFacilities.reduce((sum, f) => sum + telemedVisits(f.byYear['69']), 0)
                      const percent = totalOp > 0 ? (totalTelemed / totalOp) * 100 : 0
                      return `${percent.toFixed(1)}%`
                    })()}
                  </td>
                  <td className="px-3 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
  description,
}: {
  label: string
  value: string
  accent?: boolean
  description?: string
}) {
  return (
    <div className={`rounded-xl border-2 p-6 shadow-md transition-all hover:shadow-xl hover:scale-105 ${accent ? 'border-cyan-400 bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50' : 'border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:border-slate-400'}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
        {description && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${description === 'หลัก' ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md' : 'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 font-semibold'}`}>
            {description}
          </span>
        )}
      </div>
      <p className={`mt-3 text-4xl font-bold bg-clip-text ${accent ? 'text-transparent bg-gradient-to-r from-cyan-600 to-teal-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

export default SnapshotView
