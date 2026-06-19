import { Fragment, useMemo, useState } from 'react'
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
import type { FiscalYear, GroupBreakdownFacility, GroupBreakdownSnapshot } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import ReportInfoPanel, { type ReportInfoPanelProps } from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'

export interface GroupBreakdownViewProps {
  snapshot: GroupBreakdownSnapshot
  title: string
  /** Per-instance documentation content (differs between ncd/mch/ltc_pal). */
  docs: ReportInfoPanelProps
}

const ALL_HOSTYPES = '__all__'

function GroupBreakdownView({ snapshot, title, docs }: GroupBreakdownViewProps) {
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

  const filteredFacilities = useMemo<GroupBreakdownFacility[]>(() => {
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

  const yearKpis = useMemo(() => {
    let totalOp = 0
    let totalTelemed = 0
    for (const f of filteredFacilities) {
      const stats = f.byYear[fiscalYear]
      totalOp += stats?.op ?? 0
      totalTelemed += stats?.telemed ?? 0
    }
    return { totalOp, totalTelemed }
  }, [filteredFacilities, fiscalYear])

  const groupKpis = useMemo(() => {
    return snapshot.groupDefs.map((def) => {
      let visit = 0
      let tele = 0
      for (const f of filteredFacilities) {
        const stats = f.groups[def.key]
        visit += stats?.visit ?? 0
        tele += stats?.tele ?? 0
      }
      const percent = visit > 0 ? (tele / visit) * 100 : null
      return { ...def, visit, tele, percent }
    })
  }, [filteredFacilities, snapshot.groupDefs])

  const groupChartData = useMemo(() => {
    return groupKpis.map((g) => ({ label: g.label, visit: g.visit, tele: g.tele }))
  }, [groupKpis])

  const exportColumns = useMemo<ExportColumn<GroupBreakdownFacility>[]>(() => {
    const base: ExportColumn<GroupBreakdownFacility>[] = [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
    ]
    const groupCols: ExportColumn<GroupBreakdownFacility>[] = snapshot.groupDefs.flatMap((def) => [
      { key: `${def.key}_visit`, label: `${def.label} (visit)`, value: (f) => f.groups[def.key]?.visit ?? 0 },
      { key: `${def.key}_tele`, label: `${def.label} (tele)`, value: (f) => f.groups[def.key]?.tele ?? 0 },
    ])
    const tail: ExportColumn<GroupBreakdownFacility>[] = [
      { key: 'op', label: `OP รวม (ปีงบ ${fiscalYear})`, value: (f) => f.byYear[fiscalYear]?.op ?? 0 },
      { key: 'telemed', label: `Telemedicine รวม (ปีงบ ${fiscalYear})`, value: (f) => f.byYear[fiscalYear]?.telemed ?? 0 },
    ]
    return [...base, ...groupCols, ...tail]
  }, [snapshot.groupDefs, fiscalYear])

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label={`OP รวม (ปีงบ ${fiscalYear})`} value={yearKpis.totalOp.toLocaleString('th-TH')} />
        <KpiCard
          label={`Telemedicine รวม (ปีงบ ${fiscalYear})`}
          value={yearKpis.totalTelemed.toLocaleString('th-TH')}
          accent
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groupKpis.map((g) => (
          <div key={g.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{g.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">
              {g.visit.toLocaleString('th-TH')}
              <span className="ml-1 text-sm font-normal text-slate-400">visit</span>
            </p>
            <p className="mt-1 text-lg font-semibold text-brand-600">
              {g.tele.toLocaleString('th-TH')}
              <span className="ml-1 text-sm font-normal text-slate-400">tele</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              ร้อยละ Telemedicine: {g.percent === null ? '—' : `${g.percent.toFixed(1)}%`}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">เปรียบเทียบ Visit / Telemedicine แยกตามกลุ่ม</h3>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={groupChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
              <Tooltip
                formatter={(value) => Number(value ?? 0).toLocaleString('th-TH')}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="visit" name="Visit" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="tele" name="Telemedicine" fill="#0d9488" radius={[6, 6, 0, 0]} />
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
                {snapshot.groupDefs.map((def) => (
                  <th key={def.key} className="px-3 py-2 text-right font-medium" colSpan={2}>
                    {def.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200 text-slate-400">
                <th className="px-3 py-1" />
                <th className="px-3 py-1" />
                <th className="px-3 py-1" />
                <th className="px-3 py-1" />
                {snapshot.groupDefs.map((def) => (
                  <Fragment key={def.key}>
                    <th className="px-3 py-1 text-right text-xs font-normal">visit</th>
                    <th className="px-3 py-1 text-right text-xs font-normal">tele</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => (
                <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{f.hospcode}</td>
                  <td className="px-3 py-2 text-slate-800">{f.hospname}</td>
                  <td className="px-3 py-2 text-slate-600">{f.ampName}</td>
                  <td className="px-3 py-2 text-slate-600">{f.hostypeName}</td>
                  {snapshot.groupDefs.map((def) => {
                    const stats = f.groups[def.key]
                    return (
                      <Fragment key={def.key}>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {(stats?.visit ?? 0).toLocaleString('th-TH')}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-brand-700">
                          {(stats?.tele ?? 0).toLocaleString('th-TH')}
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={4 + snapshot.groupDefs.length * 2} className="px-3 py-6 text-center text-slate-400">
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
                  {snapshot.groupDefs.map((def) => {
                    const visit = filteredFacilities.reduce((sum, f) => sum + (f.groups[def.key]?.visit ?? 0), 0)
                    const tele = filteredFacilities.reduce((sum, f) => sum + (f.groups[def.key]?.tele ?? 0), 0)
                    return (
                      <Fragment key={def.key}>
                        <td className="px-3 py-3 text-right">{visit.toLocaleString('th-TH')}</td>
                        <td className="px-3 py-3 text-right text-brand-700">{tele.toLocaleString('th-TH')}</td>
                      </Fragment>
                    )
                  })}
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

export default GroupBreakdownView
