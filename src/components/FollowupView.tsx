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

export interface FollowupViewProps {
  snapshot: FollowupSnapshot
}

function FollowupView({ snapshot }: FollowupViewProps) {
  const [search, setSearch] = useState('')

  const [prevSnapshot, setPrevSnapshot] = useState(snapshot)
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot)
    setSearch('')
  }

  const filteredFacilities = useMemo<FollowupFacility[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return snapshot.facilities
    return snapshot.facilities.filter((f) => {
      return (
        f.hospname.toLowerCase().includes(q) ||
        f.ampName.toLowerCase().includes(q) ||
        f.hospcode.toLowerCase().includes(q)
      )
    })
  }, [snapshot, search])

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

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">ติดตามต่อเนื่อง (ปีงบ 69)</h2>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
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
              <Bar dataKey="normal" name="ติดตามแบบปกติ" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="telemed" name="ติดตามผ่าน Telemedicine" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">รหัสสถาน</th>
                <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                <th className="px-3 py-2 font-medium">อำเภอ</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 text-right font-medium">ผู้รับบริการรวม</th>
                <th className="px-3 py-2 text-right font-medium">ติดตามแบบปกติ</th>
                <th className="px-3 py-2 text-right font-medium">ติดตามผ่าน Telemedicine</th>
                <th className="px-3 py-2 text-right font-medium">ร้อยละ</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => (
                <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{f.hospcode}</td>
                  <td className="px-3 py-2 text-slate-800">{f.hospname}</td>
                  <td className="px-3 py-2 text-slate-600">{f.ampName}</td>
                  <td className="px-3 py-2 text-slate-600">{f.hostypeName}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {f.totalVisits69.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {f.followUpNormal.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-brand-700">
                    {f.followUpTelemed.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {f.percentTelemedUsage.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
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

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

export default FollowupView
