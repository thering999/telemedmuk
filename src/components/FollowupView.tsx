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
import type { FollowupFacility, FollowupSnapshot } from '../types/hdc'
import type { ExportColumn } from '../lib/exportTable'
import { CHART_COLORS } from '../lib/designSystem'
import { useSortableTable } from '../lib/useSortableTable'
import ReportInfoPanel from './ReportInfoPanel'
import ExportToolbar from './ExportToolbar'
import SortableTh from './SortableTh'

export interface FollowupViewProps {
  snapshot: FollowupSnapshot
}

const ALL_HOSTYPES = '__all__'

function FollowupView({ snapshot }: FollowupViewProps) {
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

  const filteredFacilities = useMemo<FollowupFacility[]>(() => {
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
    let totalVisits = 0
    let totalFollowUp = 0
    let totalNormal = 0
    let totalTelemed = 0
    for (const f of filteredFacilities) {
      totalVisits += f.totalVisits69
      totalFollowUp += f.followUpTotal
      totalNormal += f.followUpNormal
      totalTelemed += f.followUpTelemed
    }
    const percent = totalFollowUp > 0 ? (totalTelemed / totalFollowUp) * 100 : null
    return { totalVisits, totalFollowUp, totalNormal, totalTelemed, percent }
  }, [filteredFacilities])

  const districtChartData = useMemo(() => {
    const byDistrict = new Map<string, { normal: number; telemed: number }>()
    for (const f of filteredFacilities) {
      const entry = byDistrict.get(f.ampName) ?? { normal: 0, telemed: 0 }
      entry.normal += f.followUpNormal
      entry.telemed += f.followUpTelemed
      byDistrict.set(f.ampName, entry)
    }
    return Array.from(byDistrict.entries())
      .map(([ampName, v]) => ({ ampName, ...v }))
      .sort((a, b) => a.ampName.localeCompare(b.ampName, 'th'))
  }, [filteredFacilities])

  const exportColumns = useMemo<ExportColumn<FollowupFacility>[]>(
    () => [
      { key: 'hospcode', label: 'รหัสสถาน', value: (f) => f.hospcode },
      { key: 'hospname', label: 'สถานพยาบาล', value: (f) => f.hospname },
      { key: 'ampName', label: 'อำเภอ', value: (f) => f.ampName },
      { key: 'hostypeName', label: 'ประเภท', value: (f) => f.hostypeName },
      { key: 'totalVisits69', label: 'ผู้รับบริการรวม', value: (f) => f.totalVisits69 },
      { key: 'followUpNormal', label: 'ติดตามแบบปกติ', value: (f) => f.followUpNormal },
      { key: 'followUpTelemed', label: 'ติดตามผ่าน Telemedicine', value: (f) => f.followUpTelemed },
      { key: 'percentTelemedUsage', label: 'ร้อยละ', value: (f) => Number(f.percentTelemedUsage.toFixed(1)) },
    ],
    [],
  )

  const { sortedRows: sortedFacilities, sortKey, sortDir, toggleSort } = useSortableTable(filteredFacilities)

  return (
    <div className="flex flex-col gap-6 bg-gradient-to-b from-white via-emerald-50 to-white min-h-screen p-6 rounded-3xl dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900">
      <ReportInfoPanel
        objective="เทียบสัดส่วนการนัดติดตามต่อเนื่องแบบมาคลินิกปกติ กับแบบโทรเวชกรรม เฉพาะปีงบประมาณ 69 (ปีปัจจุบัน) — รายงานนี้ไม่มีข้อมูลปีงบ 68"
        methodology="FollowUp_Total = จำนวนครั้งที่ typein เป็น 2 หรือ 5 รวมกัน (นัดหมายปกติ + โทรเวชกรรม), FollowUp_Normal = เฉพาะ typein=2, FollowUp_Telemed = เฉพาะ typein=5 — ร้อยละคำนวณจาก FollowUp_Telemed ÷ FollowUp_Total"
        source="ตาราง service เฉพาะช่วงปีงบประมาณ 69"
        template="q_telemed_hosp_muk.ipynb"
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">ติดตามต่อเนื่อง (ปีงบ 69)</h2>
        <div className="ml-auto flex flex-col gap-1">
          <label htmlFor="hostype-select" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            ประเภทสถานบริการ
          </label>
          <select
            id="hostype-select"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
        <KpiCard label="ผู้รับบริการรวม" value={kpis.totalVisits.toLocaleString('th-TH')} />
        <KpiCard label="ติดตามต่อเนื่องรวม" value={kpis.totalFollowUp.toLocaleString('th-TH')} />
        <KpiCard label="ติดตามแบบปกติ" value={kpis.totalNormal.toLocaleString('th-TH')} />
        <KpiCard label="ติดตามผ่าน Telemedicine" value={kpis.totalTelemed.toLocaleString('th-TH')} accent />
        <KpiCard
          label="ร้อยละ Telemedicine ต่อการติดตามต่อเนื่อง"
          value={kpis.percent === null ? '—' : `${kpis.percent.toFixed(1)}%`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          การติดตามต่อเนื่องแยกตามอำเภอ: ปกติ vs Telemedicine
        </h3>
        <div style={{ width: '100%', height: 360 }}>
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
              <Bar dataKey="normal" name="ติดตามแบบปกติ" fill={CHART_COLORS.secondary} radius={[6, 6, 0, 0]} />
              <Bar dataKey="telemed" name="ติดตามผ่าน Telemedicine" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">รายละเอียดสถานพยาบาล</h3>
          <div className="flex flex-wrap items-center gap-3">
            <ExportToolbar
              filenameBase={`ติดตามต่อเนื่อง_${snapshot.snapshotDate}`}
              title={`ติดตามต่อเนื่อง (ปีงบ 69) — ${snapshot.snapshotDate}`}
              columns={exportColumns}
              rows={filteredFacilities}
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อสถานพยาบาล รหัสสถาน หรืออำเภอ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-slate-700 dark:from-slate-700 dark:to-slate-700 dark:border-slate-600 dark:text-slate-200">
                <SortableTh
                  label="รหัสสถาน"
                  active={sortKey === 'hospcode'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospcode', (f) => f.hospcode)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="สถานพยาบาล"
                  active={sortKey === 'hospname'}
                  direction={sortDir}
                  onClick={() => toggleSort('hospname', (f) => f.hospname)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="อำเภอ"
                  active={sortKey === 'ampName'}
                  direction={sortDir}
                  onClick={() => toggleSort('ampName', (f) => f.ampName)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ประเภท"
                  active={sortKey === 'hostypeName'}
                  direction={sortDir}
                  onClick={() => toggleSort('hostypeName', (f) => f.hostypeName)}
                  className="px-4 py-3 font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ผู้รับบริการรวม"
                  align="right"
                  active={sortKey === 'totalVisits69'}
                  direction={sortDir}
                  onClick={() => toggleSort('totalVisits69', (f) => f.totalVisits69)}
                  className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ติดตามแบบปกติ"
                  align="right"
                  active={sortKey === 'followUpNormal'}
                  direction={sortDir}
                  onClick={() => toggleSort('followUpNormal', (f) => f.followUpNormal)}
                  className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ติดตามผ่าน Telemedicine"
                  align="right"
                  active={sortKey === 'followUpTelemed'}
                  direction={sortDir}
                  onClick={() => toggleSort('followUpTelemed', (f) => f.followUpTelemed)}
                  className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                />
                <SortableTh
                  label="ร้อยละ"
                  align="right"
                  active={sortKey === 'percentTelemedUsage'}
                  direction={sortDir}
                  onClick={() => toggleSort('percentTelemedUsage', (f) => f.percentTelemedUsage)}
                  className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide"
                />
              </tr>
            </thead>
            <tbody>
              {sortedFacilities.map((f) => (
                <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-blue-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-slate-600 text-sm font-mono dark:text-slate-300">{f.hospcode}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium dark:text-slate-100">{f.hospname}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm dark:text-slate-300">{f.ampName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <span className="text-xs">
                      {f.hostypeName.includes('ส่งเสริมสุขภาพตำบล') ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 font-medium dark:bg-blue-900/40 dark:text-blue-300">รพสต.</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 font-medium dark:bg-slate-700 dark:text-slate-200">รพ.</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {f.totalVisits69.toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {f.followUpNormal.toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-brand-700">
                    {f.followUpTelemed.toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {f.percentTelemedUsage.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                    ไม่พบสถานพยาบาลที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
              {filteredFacilities.length > 0 && (
                <tr className="border-t-2 border-slate-400 bg-gradient-to-r from-slate-100 to-slate-50 font-bold text-slate-800 dark:border-slate-600 dark:from-slate-700 dark:to-slate-700 dark:text-slate-100">
                  <td className="px-4 py-3">รวม</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + f.totalVisits69, 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {filteredFacilities.reduce((sum, f) => sum + f.followUpNormal, 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right text-brand-700">
                    {filteredFacilities.reduce((sum, f) => sum + f.followUpTelemed, 0).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {(() => {
                      const totalAll = filteredFacilities.reduce((sum, f) => sum + f.totalVisits69, 0)
                      const totalTelemed = filteredFacilities.reduce((sum, f) => sum + f.followUpTelemed, 0)
                      const percent = totalAll > 0 ? (totalTelemed / totalAll) * 100 : 0
                      return `${percent.toFixed(1)}%`
                    })()}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-brand-600' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  )
}

export default FollowupView
