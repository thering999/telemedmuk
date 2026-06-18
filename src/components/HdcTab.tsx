import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Facility, FiscalYear, Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { FISCAL_YEARS, telemedVisits } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; index: SnapshotIndexEntry[] }

function HdcTab() {
  const [indexState, setIndexState] = useState<LoadState>({ status: 'loading' })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<{ date: string; message: string } | null>(null)
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')
  const [search, setSearch] = useState('')

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

  const filteredFacilities = useMemo<Facility[]>(() => {
    if (!snapshot) return []
    const q = search.trim().toLowerCase()
    if (!q) return snapshot.facilities
    return snapshot.facilities.filter(
      (f) => f.hospname.toLowerCase().includes(q) || f.ampName.toLowerCase().includes(q),
    )
  }, [snapshot, search])

  const kpis = useMemo(() => {
    if (!snapshot) return { totalOp: 0, totalTelemed: 0, percent: 0 }
    let totalOp = 0
    let totalTelemed = 0
    for (const f of snapshot.facilities) {
      const stats = f.byYear[fiscalYear]
      totalOp += stats?.op ?? 0
      totalTelemed += telemedVisits(stats)
    }
    const percent = totalOp > 0 ? (totalTelemed / totalOp) * 100 : 0
    return { totalOp, totalTelemed, percent }
  }, [snapshot, fiscalYear])

  const chartData = useMemo(() => {
    if (!snapshot) return []
    const byDistrict = new Map<string, number>()
    for (const f of snapshot.facilities) {
      const visits = telemedVisits(f.byYear[fiscalYear])
      byDistrict.set(f.ampName, (byDistrict.get(f.ampName) ?? 0) + visits)
    }
    return Array.from(byDistrict.entries())
      .map(([ampName, telemed]) => ({ ampName, telemed }))
      .sort((a, b) => b.telemed - a.telemed)
  }, [snapshot, fiscalYear])

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

      {currentError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          เกิดข้อผิดพลาดในการโหลดสแนปช็อต: {currentError}
        </p>
      )}

      {(!snapshot || isStale) && !currentError && (
        <p className="text-center text-slate-500">กำลังโหลดข้อมูลสแนปช็อต...</p>
      )}

      {snapshot && !isStale && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label={`OP รวม (ปีงบ ${fiscalYear})`} value={kpis.totalOp.toLocaleString('th-TH')} />
            <KpiCard
              label={`ผู้รับบริการโทรเวชกรรมรวม (ปีงบ ${fiscalYear})`}
              value={kpis.totalTelemed.toLocaleString('th-TH')}
            />
            <KpiCard label="ร้อยละโทรเวชกรรมต่อ OP" value={`${kpis.percent.toFixed(1)}%`} accent />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              จำนวนผู้รับบริการโทรเวชกรรมแยกตามอำเภอ (ปีงบ {fiscalYear})
            </h3>
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
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
                  <Bar dataKey="telemed" name="ผู้รับบริการโทรเวชกรรม" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-800">รายละเอียดสถานพยาบาล</h3>
              <input
                type="text"
                placeholder="ค้นหาชื่อสถานพยาบาลหรืออำเภอ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-medium">สถานพยาบาล</th>
                    <th className="px-3 py-2 font-medium">อำเภอ</th>
                    <th className="px-3 py-2 font-medium">ประเภท</th>
                    <th className="px-3 py-2 text-right font-medium">OP รวม</th>
                    <th className="px-3 py-2 text-right font-medium">Type2</th>
                    <th className="px-3 py-2 text-right font-medium">Type3</th>
                    <th className="px-3 py-2 text-right font-medium">Type5</th>
                    <th className="px-3 py-2 text-right font-medium">รวมโทรเวชกรรม</th>
                    <th className="px-3 py-2 text-right font-medium">ร้อยละ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacilities.map((f) => {
                    const stats = f.byYear[fiscalYear]
                    const telemed = telemedVisits(stats)
                    const op = stats?.op ?? 0
                    const percent = op > 0 ? (telemed / op) * 100 : 0
                    return (
                      <tr key={f.hospcode} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{f.hospname}</td>
                        <td className="px-3 py-2 text-slate-600">{f.ampName}</td>
                        <td className="px-3 py-2 text-slate-600">{f.hostypeName}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{op.toLocaleString('th-TH')}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {(stats?.type2 ?? 0).toLocaleString('th-TH')}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {(stats?.type3 ?? 0).toLocaleString('th-TH')}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {(stats?.type5 ?? 0).toLocaleString('th-TH')}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {telemed.toLocaleString('th-TH')}
                        </td>
                        <td className="px-3 py-2 text-right text-brand-700">{percent.toFixed(1)}%</td>
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
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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

export default HdcTab
