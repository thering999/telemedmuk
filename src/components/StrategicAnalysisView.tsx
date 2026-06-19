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
import ReportInfoPanel from './ReportInfoPanel'

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

const TARGET_RATE = 30

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
  return stats.type2 + stats.type3 + stats.type5
}

/** TYPEIN5 ÷ (TYPEIN2+TYPEIN3+TYPEIN5) × 100 — null when denominator is 0 ("ไม่มีข้อมูล"), never NaN/0-by-force. */
function officialRate(stats: TypeYearStats | undefined): number | null {
  if (!stats) return null
  const den = officialDenominator(stats)
  if (den <= 0) return null
  return (stats.type5 / den) * 100
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

function StrategicAnalysisView({ baseSnapshot, allSnapshot }: StrategicAnalysisViewProps) {
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')
  const [search, setSearch] = useState('')

  const [prevSnapshot, setPrevSnapshot] = useState(allSnapshot)
  if (allSnapshot !== prevSnapshot) {
    setPrevSnapshot(allSnapshot)
    setSearch('')
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

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel
        objective="เปรียบเทียบสถานบริการกับเกณฑ์มาตรฐานระดับประเทศ จัดกลุ่มเชิงกลยุทธ์ และคาดการณ์แนวโน้มการใช้บริการโทรเวชกรรม เพื่อสนับสนุนการตัดสินใจเชิงนโยบาย"
        methodology="ใช้สูตรตัวชี้วัดทางการ: อัตรา = TYPEIN5 ÷ (TYPEIN2+TYPEIN3+TYPEIN5) × 100 เป้าหมายของกระทรวงสาธารณสุขคือไม่น้อยกว่าร้อยละ 30 (ฐานข้อมูลอ้างอิงระดับประเทศอยู่ที่ประมาณ 8-9% ณ ช่วงเวลาที่อ้างอิง) การจัดกลุ่มเชิงกลยุทธ์ 4 ส่วน (Champions/Sleeping Giants/Active Small/Waiting for Support) แบ่งตามค่ามัธยฐาน (median) ของ OP และอัตราในกลุ่มสถานบริการที่กำลังดูอยู่ ส่วนสถานบริการที่มีอัตราเกิน 50% จะถูกตั้งข้อสังเกตให้ตรวจสอบความถูกต้องของข้อมูลใน HDC"
        source="ตาราง service (ระบบ Hippo) ผ่านข้อมูลหมวด 'แยกประเภทบริการ' (Type1-5) ร่วมกับข้อมูลสังกัด (MCODE/M_NAME) จากรายงานภาพรวม"
        template="ร่าง SOP ขับเคลื่อน Telemedicine, MOPH Telemedicine 2569 (นพ.วรเวทย์ โรจน์จรัสไพศาล, รองผู้อำนวยการสำนักสุขภาพดิจิทัล, 11 พ.ค. 2569) — เกณฑ์เป้าหมาย 30% อ้างอิงจากเอกสารนี้; กรอบวิเคราะห์ 4 ส่วน (quadrant) และการพยากรณ์ดัดแปลงจากการวิเคราะห์ส่วนตัวใน q_telemed_hosp_muk.ipynb"
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">วิเคราะห์เชิงกลยุทธ์</h2>
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

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">อัตราตามเกณฑ์ สธ. (มาตรฐานทางการ)</p>
          {provinceKpis.aggregateRate === null ? (
            <p className="mt-2 text-3xl font-semibold text-slate-800">ไม่มีข้อมูล</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold text-slate-800">
                {provinceKpis.aggregateRate.toFixed(2)}%
              </p>
              <p className="mt-1 text-sm text-slate-500">
                เป้าหมาย {TARGET_RATE.toFixed(1)}%{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    provinceKpis.aggregateRate >= TARGET_RATE
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {provinceKpis.aggregateRate >= TARGET_RATE
                    ? 'ถึงเป้าหมายแล้ว'
                    : `ขาดอีก ${(TARGET_RATE - provinceKpis.aggregateRate).toFixed(1)} จุด`}
                </span>
              </p>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">อัตราการเริ่มใช้งาน (Activation Rate)</p>
          <p className="mt-2 text-3xl font-semibold text-brand-600">
            {provinceKpis.activationRate === null ? '—' : `${provinceKpis.activationRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-sm text-slate-500">สัดส่วนสถานบริการที่มี Type5 &gt; 0</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">จำนวนสถานบริการที่ควรตรวจสอบ</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">{provinceKpis.anomalyCount}</p>
          <p className="mt-1 text-sm text-slate-500">อัตราเกิน 50% (ควรตรวจสอบใน HDC)</p>
        </div>
      </div>

      {forecast && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-1">
            <p className="text-sm text-slate-500">คาดการณ์ปีงบ 70 (ค่าประมาณ)</p>
            <p className="mt-2 text-3xl font-semibold text-brand-600">
              {forecast.projected.toLocaleString('th-TH')}
              <span className="ml-1 text-sm font-normal text-slate-400">ครั้ง</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              ประมาณการแบบเส้นตรงจาก Type5: ปีงบ 68 = {forecast.total68.toLocaleString('th-TH')}, ปีงบ 69 ={' '}
              {forecast.total69.toLocaleString('th-TH')}
            </p>
          </div>
        </div>
      )}

      {/* MOPH vs LGO comparison */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          เปรียบเทียบตามสังกัด (ปีงบ {fiscalYear})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">สังกัด</th>
                <th className="px-3 py-2 text-right font-medium">จำนวนหน่วย</th>
                <th className="px-3 py-2 text-right font-medium">OP รวม</th>
                <th className="px-3 py-2 text-right font-medium">Telemedicine รวม (Type5)</th>
                <th className="px-3 py-2 text-right font-medium">อัตราตามเกณฑ์ สธ. %</th>
              </tr>
            </thead>
            <tbody>
              {affiliationComparison.map((row) => (
                <tr key={row.mName} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{row.mName}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.count.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {row.totalOp.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-brand-700">
                    {row.totalType5.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {row.rate === null ? '—' : `${row.rate.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
              {affiliationComparison.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          การจัดกลุ่มเชิงกลยุทธ์ 4 ส่วน (ปีงบ {fiscalYear})
        </h3>
        <p className="mb-4 text-sm text-slate-500">
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
              <div key={quadrant} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold" style={{ color: QUADRANT_META[quadrant].color }}>
                  {QUADRANT_META[quadrant].label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-800">{rows.length}</p>
                <p className="text-xs text-slate-500">สถานบริการ</p>
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-slate-600">
                  {rows.map((row) => (
                    <li key={row.facility.hospcode} className="truncate py-0.5">
                      {row.facility.hospname}
                    </li>
                  ))}
                  {rows.length === 0 && <li className="py-0.5 text-slate-400">ไม่มี</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Anomaly review table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          สถานบริการที่ควรตรวจสอบ (อัตราเกิน 50%, ปีงบ {fiscalYear})
        </h3>
        {anomalyRows.length === 0 ? (
          <p className="text-center text-slate-400">ไม่พบสถานบริการที่ควรตรวจสอบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                  <th className="px-3 py-2 font-medium">อำเภอ</th>
                  <th className="px-3 py-2 font-medium">สังกัด</th>
                  <th className="px-3 py-2 text-right font-medium">Type5</th>
                  <th className="px-3 py-2 text-right font-medium">TYPEIN2+3+5</th>
                  <th className="px-3 py-2 text-right font-medium">อัตรา %</th>
                  <th className="px-3 py-2 font-medium">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {anomalyRows.map((row) => (
                  <tr key={row.facility.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{row.facility.hospname}</td>
                    <td className="px-3 py-2 text-slate-600">{row.facility.ampName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.facility.mName}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.type5.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {row.denominator.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-rose-600">
                      {(row.rate ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-rose-600">ควรตรวจสอบใน HDC</td>
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
          <input
            type="text"
            placeholder="ค้นหาชื่อสถานพยาบาล รหัสสถาน หรืออำเภอ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 font-medium">สังกัด</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 text-right font-medium">OP</th>
                <th className="px-3 py-2 text-right font-medium">Type5 (Telemedicine)</th>
                <th className="px-3 py-2 text-right font-medium">อัตราตามเกณฑ์ สธ. %</th>
                <th className="px-3 py-2 font-medium">กลุ่มเชิงกลยุทธ์</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((row) => {
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
              {yearRows.length === 0 && (
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
    </div>
  )
}

export default StrategicAnalysisView
