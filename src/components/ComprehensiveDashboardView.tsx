import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Snapshot, TypeBreakdownSnapshot, TypeYearStats } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'

export interface ComprehensiveDashboardViewProps {
  baseSnapshot: Snapshot
  allSnapshot: TypeBreakdownSnapshot
}

function officialRate(stats: TypeYearStats | undefined): number | null {
  if (!stats) return null
  const op = stats.op ?? 0
  if (op <= 0) return null
  return (stats.type5 / op) * 100
}

function ComprehensiveDashboardView({ baseSnapshot, allSnapshot }: ComprehensiveDashboardViewProps) {
  const [fiscalYear, setFiscalYear] = useState<'68' | '69'>('69')

  const baseByCode = useMemo(() => new Map(baseSnapshot.facilities.map((f) => [f.hospcode, f])), [baseSnapshot])

  const combined = useMemo(
    () =>
      allSnapshot.facilities.map((f) => {
        const base = baseByCode.get(f.hospcode)
        return {
          hospcode: f.hospcode,
          hospname: f.hospname,
          ampName: f.ampName,
          hostypeName: f.hostypeName,
          mName: base?.mName ?? 'ไม่ทราบสังกัด',
          byYear: f.byYear,
        }
      }),
    [allSnapshot, baseByCode]
  )

  const yearRows = useMemo(() => {
    return combined.map((f) => {
      const stats = f.byYear[fiscalYear]
      return { facility: f, stats, op: stats?.op ?? 0, type5: stats?.type5 ?? 0, rate: officialRate(stats) }
    })
  }, [combined, fiscalYear])

  // Chart 7: Continuity Status (Pie)
  const continuityData = useMemo(() => {
    let interrupted = 0
    let sustainable = 0
    for (const row of yearRows) {
      if (!row.stats) continue
      // Assume: rate > 50% or type5 = 0 = interrupted; otherwise sustainable
      if (row.rate === null || row.rate === 0 || row.rate > 50) {
        interrupted++
      } else {
        sustainable++
      }
    }
    const total = interrupted + sustainable
    return [
      { name: 'หยุดระงับ (Interrupted)', value: total > 0 ? (interrupted / total) * 100 : 0, count: interrupted },
      { name: 'ต่อเนื่อง (Sustainable)', value: total > 0 ? (sustainable / total) * 100 : 0, count: sustainable },
    ]
  }, [yearRows])

  // Chart 8: Usage Distribution by Hospital (Pie)
  const hospitalDistribution = useMemo(() => {
    const byHosp = new Map<string, number>()
    for (const row of yearRows) {
      const key = row.facility.hospname
      byHosp.set(key, (byHosp.get(key) ?? 0) + row.type5)
    }
    const total = Array.from(byHosp.values()).reduce((a, b) => a + b, 0)
    return Array.from(byHosp.entries())
      .map(([name, value]) => ({
        name,
        value: total > 0 ? (value / total) * 100 : 0,
        count: value,
      }))
      .sort((a, b) => b.count - a.count)
  }, [yearRows])

  // Chart 9: Efficiency Matrix (Scatter)
  const efficiencyData = useMemo(() => {
    const byAmp = new Map<
      string,
      { ampName: string; op: number; type5: number; rate: number | null; color: string }
    >()
    const colors = ['#3b82f6', '#f97316', '#22c55e', '#ef4444', '#a855f7', '#8b5cf6', '#ec4899']
    const ampList = Array.from(new Set(combined.map((f) => f.ampName))).sort()
    ampList.forEach((amp, idx) => {
      byAmp.set(amp, { ampName: amp, op: 0, type5: 0, rate: null, color: colors[idx % colors.length] })
    })
    for (const row of yearRows) {
      const amp = row.facility.ampName
      const entry = byAmp.get(amp)!
      entry.op += row.op
      entry.type5 += row.type5
    }
    for (const [, entry] of byAmp) {
      entry.rate = entry.op > 0 ? (entry.type5 / entry.op) * 100 : null
    }
    return Array.from(byAmp.values())
  }, [combined, yearRows])

  // Chart 10: Service Distribution by Affiliation (Stacked Bar)
  const affiliationDistribution = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; moph: number; lgo: number; other: number }>()
    for (const row of yearRows) {
      const key = row.facility.ampName
      const entry = byAmp.get(key) ?? { ampName: key, moph: 0, lgo: 0, other: 0 }
      if (row.facility.mName.includes('สาธารณสุข') || row.facility.mName.includes('กระทรวง')) {
        entry.moph += row.type5
      } else if (row.facility.mName.includes('อบท') || row.facility.mName.includes('องค์กร')) {
        entry.lgo += row.type5
      } else {
        entry.other += row.type5
      }
      byAmp.set(key, entry)
    }
    return Array.from(byAmp.values()).sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // Chart 11: Lollipop (2570 Forecast vs 5% Target)
  const lollipopData = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; target: number; forecast: number }>()
    for (const row of yearRows) {
      const key = row.facility.ampName
      const entry = byAmp.get(key) ?? { ampName: key, target: 0, forecast: 0 }
      entry.forecast += row.type5
      entry.target = Math.max(entry.target, entry.forecast * 1.05)
      byAmp.set(key, entry)
    }
    return Array.from(byAmp.values()).sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // Chart 1: Telemedicine Usage by Affiliation (Horizontal Bar)
  const usageByAffiliation = useMemo(() => {
    const byMName = new Map<string, number>()
    for (const row of yearRows) {
      const key = row.facility.mName
      byMName.set(key, (byMName.get(key) ?? 0) + row.type5)
    }
    return Array.from(byMName.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [yearRows])

  // Chart 2: Market Share % by District
  const marketShareByDistrict = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; type5: number; op: number }>()
    for (const row of yearRows) {
      const key = row.facility.ampName
      const entry = byAmp.get(key) ?? { ampName: key, type5: 0, op: 0 }
      entry.type5 += row.type5
      entry.op += row.op
      byAmp.set(key, entry)
    }
    return Array.from(byAmp.values())
      .map((e) => ({
        ...e,
        percentage: e.op > 0 ? (e.type5 / e.op) * 100 : 0,
      }))
      .sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // Chart 3: Progress by RPST (Year comparison)
  const rpstProgressByYear = useMemo(() => {
    const by68 = new Map<string, number>()
    const by69 = new Map<string, number>()
    for (const f of combined) {
      if (f.hostypeName.includes('ส่งเสริมสุขภาพตำบล')) {
        const amp = f.ampName
        if (f.byYear['68']) by68.set(amp, (by68.get(amp) ?? 0) + (f.byYear['68'].type5 ?? 0))
        if (f.byYear['69']) by69.set(amp, (by69.get(amp) ?? 0) + (f.byYear['69'].type5 ?? 0))
      }
    }
    const ampSet = new Set([...by68.keys(), ...by69.keys()])
    return Array.from(ampSet)
      .map((amp) => ({ name: amp, fy68: by68.get(amp) ?? 0, fy69: by69.get(amp) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [combined])

  // Chart 4: Adoption Status by RPST
  const adoptionStatusByRpst = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; notStarted: number; started: number }>()
    for (const row of yearRows) {
      if (row.facility.hostypeName.includes('ส่งเสริมสุขภาพตำบล')) {
        const key = row.facility.ampName
        const entry = byAmp.get(key) ?? { ampName: key, notStarted: 0, started: 0 }
        if (row.type5 === 0) entry.notStarted += 1
        else entry.started += 1
        byAmp.set(key, entry)
      }
    }
    return Array.from(byAmp.values()).sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // Chart 5: 2570 Forecast Success Rate
  const forecastSuccessRate = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; actual: number; target: number }>()
    for (const row of yearRows) {
      const key = row.facility.ampName
      const entry = byAmp.get(key) ?? { ampName: key, actual: 0, target: 0 }
      entry.actual += row.type5
      entry.target = Math.max(entry.target, entry.actual * 1.05)
      byAmp.set(key, entry)
    }
    return Array.from(byAmp.values()).sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [yearRows])

  // Chart 6: MOPH vs LGO Comparison
  const mophVsLgoComparison = useMemo(() => {
    const byAmp = new Map<string, { ampName: string; moph: number; mophRate: number; lgo: number; lgoRate: number }>()
    const byAmpOp = new Map<string, { mophOp: number; lgoOp: number }>()
    for (const row of yearRows) {
      const key = row.facility.ampName
      const entry = byAmp.get(key) ?? { ampName: key, moph: 0, mophRate: 0, lgo: 0, lgoRate: 0 }
      const opEntry = byAmpOp.get(key) ?? { mophOp: 0, lgoOp: 0 }
      if (row.facility.mName.includes('สาธารณสุข') || row.facility.mName.includes('กระทรวง')) {
        entry.moph += row.type5
        opEntry.mophOp += row.op
      } else {
        entry.lgo += row.type5
        opEntry.lgoOp += row.op
      }
      byAmp.set(key, entry)
      byAmpOp.set(key, opEntry)
    }
    return Array.from(byAmp.values()).map((e) => {
      const op = byAmpOp.get(e.ampName)!
      return {
        ...e,
        mophRate: op.mophOp > 0 ? (e.moph / op.mophOp) * 100 : 0,
        lgoRate: op.lgoOp > 0 ? (e.lgo / op.lgoOp) * 100 : 0,
      }
    })
  }, [yearRows])

  const COLORS_CONT = ['#3b82f6', '#cbd5e1']
  const COLORS_HOSP = ['#3b82f6', '#f97316', '#22c55e', '#ef4444', '#a855f7', '#8b5cf6', '#ec4899']
  const COLORS_AFFIL = ['#1e40af', '#f97316', '#06b6d4']

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="font-semibold text-slate-800">ปีงบประมาณ</h2>
        <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
          {FISCAL_YEARS.map((year) => (
            <button
              key={year}
              onClick={() => setFiscalYear(year as '68' | '69')}
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

      {/* Chart 1: Usage by Affiliation */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">ปริมาณการใช้ Telemedicine แยกตามสังกัด</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={usageByAffiliation}
              layout="vertical"
              margin={{ left: 150, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Market Share % */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">สัดส่วนการบินเชื่อม (Market Share) รายอำเภอ (%)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={marketShareByDistrict}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" unit="%" domain={[0, 100]} />
              <YAxis dataKey="ampName" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Bar dataKey="percentage" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Progress by Year */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">ความก้าวหน้า Telemedicine ปี 68 vs 69 (รพ.สต.)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={rpstProgressByYear}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="fy68" fill="#2c3e50" radius={[0, 6, 6, 0]} name="ปี 68" />
              <Bar dataKey="fy69" fill="#27ae60" radius={[0, 6, 6, 0]} name="ปี 69" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 4: Adoption Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">สถานะการเข้าถึง Telemedicine (รพ.สต.)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={adoptionStatusByRpst}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="ampName" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="notStarted" stackId="a" fill="#22c55e" name="ยังไม่เริ่มใช้งาน" />
              <Bar dataKey="started" stackId="a" fill="#ef4444" name="เริ่มใช้งานแล้ว" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 5: Forecast Success */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">พยากรณ์ความสำเร็จ 2570: ค่าตาจริงยอดบริการ vs เป้าหมาย 5%</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={forecastSuccessRate}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="ampName" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="actual" fill="#60a5fa" name="ยอดพยากรณ์ 2570" radius={[0, 6, 6, 0]} />
              <Bar dataKey="target" fill="#f87171" name="เป้าหมาย 5%" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 6: MOPH vs LGO */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">เปรียบเทียบยอดการใช้ Telemedicine: สธ. vs อบท.</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={mophVsLgoComparison}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="ampName" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="moph" fill="#22c55e" name="สธ." radius={[0, 6, 6, 0]} />
              <Bar dataKey="lgo" fill="#f97316" name="อบท." radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 7: Continuity Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">สรุปสถานความต่อเนื่อง Telemedicine</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={continuityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name} ${entry.value.toFixed(1)}%`}
                outerRadius={100}
                fill="#3b82f6"
                dataKey="value"
              >
                {continuityData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_CONT[idx]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 8: Hospital Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">สัดส่วนการใช้ Telemedicine แบ่งตามโรงพยาบาล</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={hospitalDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name} ${entry.value.toFixed(1)}%`}
                outerRadius={100}
                fill="#3b82f6"
                dataKey="value"
              >
                {hospitalDistribution.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_HOSP[idx % COLORS_HOSP.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 9: Efficiency Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Efficiency Matrix: OP vs Utilization %</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="op"
                name="OP Load"
                tick={{ fontSize: 12, fill: '#475569' }}
                label={{ value: 'OP Load', position: 'bottom', offset: 10, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="rate"
                name="Util %"
                unit="%"
                tick={{ fontSize: 12, fill: '#475569' }}
                label={{ value: 'Util %', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <ZAxis range={[100, 300]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => `${Number(v).toFixed(2)}`} />
              <Legend />
              {efficiencyData.map((amp) => (
                <Scatter key={amp.ampName} name={amp.ampName} data={[amp]} fill={amp.color} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 10: Affiliation Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">สัดส่วนบริการ: สธ. vs อบท. รายอำเภอ</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={affiliationDistribution} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="ampName" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="moph" stackId="a" fill={COLORS_AFFIL[0]} name="สธ." />
              <Bar dataKey="lgo" stackId="a" fill={COLORS_AFFIL[1]} name="อบท." />
              <Bar dataKey="other" stackId="a" fill={COLORS_AFFIL[2]} name="อื่น" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 11: Lollipop (2570 Forecast) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Lollipop: พยากรณ์ 2570 vs เป้าหมาย 5%</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">อำเภอ</th>
                <th className="px-3 py-2 text-right font-medium">เป้าหมาย 5%</th>
                <th className="px-3 py-2 text-right font-medium">พยากรณ์ 2570</th>
                <th className="px-3 py-2 text-left font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {lollipopData.map((row) => (
                <tr key={row.ampName} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{row.ampName}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{row.target.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-medium">{row.forecast.toFixed(0)}</td>
                  <td className="px-3 py-2">
                    {row.forecast >= row.target ? '✓ ถึงเป้า' : '⚠️ ขาด'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ComprehensiveDashboardView
