import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FiscalYear, TypeBreakdownFacility, TypeBreakdownSnapshot } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import ReportInfoPanel, { type ReportInfoPanelProps } from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'

const TYPE_SERIES: { key: 'type1' | 'type2' | 'type3' | 'type4' | 'type5'; label: string; color: string }[] = [
  { key: 'type1', label: 'Type1 Walk-in', color: '#0d9488' },
  { key: 'type2', label: 'Type2 Appointment/Refer', color: '#2563eb' },
  { key: 'type3', label: 'Type3 Community outreach', color: '#f59e0b' },
  { key: 'type4', label: 'Type4 Home visit', color: '#7c3aed' },
  { key: 'type5', label: 'Type5 Telemedicine', color: '#dc2626' },
]

export interface TypeBreakdownViewProps {
  snapshot: TypeBreakdownSnapshot
  /** Word used for the value unit, e.g. "ครั้ง" (visits) or "คน" (persons). */
  valueLabel: string
  /** Section title, e.g. "แยกประเภทบริการ" or "รายคน". */
  title: string
  /** Per-instance documentation content (differs between "all" and "person"). */
  docs: ReportInfoPanelProps
}

const ALL_HOSTYPES = '__all__'

function TypeBreakdownView({ snapshot, valueLabel, title, docs }: TypeBreakdownViewProps) {
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')
  const [search, setSearch] = useState('')
  const [hostype, setHostype] = useState<string>(ALL_HOSTYPES)

  const [prevSnapshot, setPrevSnapshot] = useState(snapshot)
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot)
    setSearch('')
    setHostype(ALL_HOSTYPES)
  }

  const hostypeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of snapshot.facilities) set.add(f.hostypeName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [snapshot])

  const filteredFacilities = useMemo<TypeBreakdownFacility[]>(() => {
    const q = search.trim().toLowerCase()
    return snapshot.facilities.filter((f) => {
      if (hostype !== ALL_HOSTYPES && f.hostypeName !== hostype) return false
      if (!q) return true
      return (
        f.hospname.toLowerCase().includes(q) ||
        f.ampName.toLowerCase().includes(q) ||
        f.hospcode.toLowerCase().includes(q)
      )
    })
  }, [snapshot, search, hostype])

  const kpis = useMemo(() => {
    let totalAll = 0
    let totalOp = 0
    let totalType5 = 0
    for (const f of filteredFacilities) {
      const stats = f.byYear[fiscalYear]
      totalAll += stats?.service ?? 0
      totalOp += stats?.op ?? 0
      totalType5 += stats?.type5 ?? 0
    }
    return { totalAll, totalOp, totalType5 }
  }, [filteredFacilities, fiscalYear])

  const districtChartData = useMemo(() => {
    const byDistrict = new Map<string, Record<string, number>>()
    for (const f of filteredFacilities) {
      const stats = f.byYear[fiscalYear]
      if (!stats) continue
      const entry = byDistrict.get(f.ampName) ?? { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0 }
      entry.type1 += stats.type1
      entry.type2 += stats.type2
      entry.type3 += stats.type3
      entry.type4 += stats.type4
      entry.type5 += stats.type5
      byDistrict.set(f.ampName, entry)
    }
    return Array.from(byDistrict.entries())
      .map(([ampName, types]) => ({ ampName, ...types }))
      .sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [filteredFacilities, fiscalYear])

  const exportColumns = useMemo<ExportColumn<TypeBreakdownFacility>[]>(() => {
    return [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
      { key: 'type1', label: 'Type1', value: (f) => f.byYear[fiscalYear]?.type1 ?? 0 },
      { key: 'type2', label: 'Type2', value: (f) => f.byYear[fiscalYear]?.type2 ?? 0 },
      { key: 'type3', label: 'Type3', value: (f) => f.byYear[fiscalYear]?.type3 ?? 0 },
      { key: 'type4', label: 'Type4', value: (f) => f.byYear[fiscalYear]?.type4 ?? 0 },
      { key: 'type5', label: 'Type5', value: (f) => f.byYear[fiscalYear]?.type5 ?? 0 },
      { key: 'op', label: 'OP รวม', value: (f) => f.byYear[fiscalYear]?.op ?? 0 },
    ]
  }, [fiscalYear])

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel {...docs} />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
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
          label={`รวมทั้งหมด (ปีงบ ${fiscalYear})`}
          value={`${kpis.totalAll.toLocaleString('th-TH')} ${valueLabel}`}
        />
        <KpiCard label={`OP รวม (ปีงบ ${fiscalYear})`} value={kpis.totalOp.toLocaleString('th-TH')} />
        <KpiCard
          label={`Telemedicine รวม (ปีงบ ${fiscalYear})`}
          value={`${kpis.totalType5.toLocaleString('th-TH')} ${valueLabel}`}
          accent
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          จำนวน{valueLabel}แยกตามประเภทบริการและอำเภอ (ปีงบ {fiscalYear})
        </h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={districtChartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
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
                formatter={(value) => Number(value ?? 0).toLocaleString('th-TH')}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {TYPE_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`${title}_${snapshot.snapshotDate}`}
              title={`${title} (ปีงบ ${fiscalYear}) — ${snapshot.snapshotDate}`}
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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 text-right font-medium">Type1</th>
                <th className="px-3 py-2 text-right font-medium">Type2</th>
                <th className="px-3 py-2 text-right font-medium">Type3</th>
                <th className="px-3 py-2 text-right font-medium">Type4</th>
                <th className="px-3 py-2 text-right font-medium">Type5</th>
                <th className="px-3 py-2 text-right font-medium">OP รวม</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => {
                const stats = f.byYear[fiscalYear]
                return (
                  <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{f.hospcode}</td>
                    <td className="px-3 py-2 text-slate-800">{f.hospname}</td>
                    <td className="px-3 py-2 text-slate-600">{f.ampName}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <span className="text-xs">
                        {f.hostypeName.includes('ส่งเสริมสุขภาพตำบล') ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 font-medium">รพสต.</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 font-medium">รพ.</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(stats?.type1 ?? 0).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(stats?.type2 ?? 0).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(stats?.type3 ?? 0).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(stats?.type4 ?? 0).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-brand-700">
                      {(stats?.type5 ?? 0).toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {(stats?.op ?? 0).toLocaleString('th-TH')}
                    </td>
                  </tr>
                )
              })}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
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
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.type1 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.type2 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.type3 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.type4 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-700">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.type5 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear[fiscalYear]?.op ?? 0), 0).toLocaleString('th-TH')}
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

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

export default TypeBreakdownView
