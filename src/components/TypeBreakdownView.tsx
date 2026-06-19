import { useMemo, useState } from 'react'
import type { TypeBreakdownFacility, TypeBreakdownSnapshot } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import ReportInfoPanel, { type ReportInfoPanelProps } from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'

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
    let totalOp68 = 0
    let totalTypes69 = 0
    for (const f of filteredFacilities) {
      const op68 = f.byYear['68']
      const types69 = f.byYear['69']
      totalOp68 += op68?.op ?? 0
      totalTypes69 += ((types69?.type2 ?? 0) + (types69?.type3 ?? 0) + (types69?.type5 ?? 0))
    }
    const percent = totalOp68 > 0 ? (totalTypes69 / totalOp68) * 100 : 0
    return { totalOp68, totalTypes69, percent }
  }, [filteredFacilities])

  const exportColumns = useMemo<ExportColumn<TypeBreakdownFacility>[]>(() => {
    return [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
      { key: 'op68', label: 'OP68', value: (f) => f.byYear['68']?.op ?? 0 },
      { key: 'type2', label: 'Type2 (69)', value: (f) => f.byYear['69']?.type2 ?? 0 },
      { key: 'type3', label: 'Type3 (69)', value: (f) => f.byYear['69']?.type3 ?? 0 },
      { key: 'type5', label: 'Type5 (69)', value: (f) => f.byYear['69']?.type5 ?? 0 },
      {
        key: 'typeSum',
        label: 'Type2+3+5 รวม',
        value: (f) => ((f.byYear['69']?.type2 ?? 0) + (f.byYear['69']?.type3 ?? 0) + (f.byYear['69']?.type5 ?? 0)),
      },
    ]
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <ReportInfoPanel {...docs} />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <div className="ml-auto flex flex-col gap-1">
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="OP68 รวม" value={kpis.totalOp68.toLocaleString('th-TH')} />
        <KpiCard
          label="Type2 รวม"
          value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
        />
        <KpiCard
          label="Type3 รวม"
          value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
        />
        <KpiCard
          label="Type5 รวม"
          value={filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
          accent
        />
        <KpiCard
          label="รวม Type2+3+5"
          value={kpis.totalTypes69.toLocaleString('th-TH')}
          accent
        />
      </div>


      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`${title}_${snapshot.snapshotDate}`}
              title={`${title} (OP68 vs Type2+3+5/69) — ${snapshot.snapshotDate}`}
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
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 text-right font-medium">OP68</th>
                <th className="px-3 py-2 text-right font-medium">Type2 (69)</th>
                <th className="px-3 py-2 text-right font-medium">Type3 (69)</th>
                <th className="px-3 py-2 text-right font-medium">Type5 (69)</th>
                <th className="px-3 py-2 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => {
                const op68 = f.byYear['68']?.op ?? 0
                const type2 = f.byYear['69']?.type2 ?? 0
                const type3 = f.byYear['69']?.type3 ?? 0
                const type5 = f.byYear['69']?.type5 ?? 0
                const typeSum = type2 + type3 + type5
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
                    <td className="px-3 py-2 text-right text-slate-700">{op68.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{type2.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{type3.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right font-medium text-brand-700">{type5.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{typeSum.toLocaleString('th-TH')}</td>
                  </tr>
                )
              })}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
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
                  <td className="px-3 py-3 text-right">{kpis.totalOp68.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-700">
                    {filteredFacilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-700">{kpis.totalTypes69.toLocaleString('th-TH')}</td>
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
