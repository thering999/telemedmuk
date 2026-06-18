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

const ALL_DISTRICTS = '__all__'
const ALL_FACILITIES = '__all__'

const PIE_COLORS = ['#0d9488', '#2563eb', '#f59e0b']

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

export interface SnapshotViewProps {
  snapshot: Snapshot
  /**
   * Optional: the full snapshot index, used only to power the "telemed
   * visits over time" line chart across multiple snapshots. When omitted
   * (e.g. for an ad hoc uploaded file that has no index), the line chart
   * section is skipped entirely.
   */
  snapshotIndex?: SnapshotIndexEntry[]
}

function SnapshotView({ snapshot, snapshotIndex }: SnapshotViewProps) {
  const [fiscalYear, setFiscalYear] = useState<FiscalYear>('69')
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState<string>(ALL_DISTRICTS)
  const [facilityCode, setFacilityCode] = useState<string>(ALL_FACILITIES)

  // Reset the filters whenever the snapshot itself changes (new data
  // loaded), without an extra effect-driven render: adjust state during
  // render per React's "you might not need an effect" guidance, tracking
  // the previous snapshot to detect the change.
  const [prevSnapshot, setPrevSnapshot] = useState(snapshot)
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot)
    setDistrict(ALL_DISTRICTS)
    setFacilityCode(ALL_FACILITIES)
    setSearch('')
  }

  const districtOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of snapshot.facilities) set.add(f.ampName)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [snapshot])

  const facilityOptions = useMemo(() => {
    const facilities =
      district === ALL_DISTRICTS
        ? snapshot.facilities
        : snapshot.facilities.filter((f) => f.ampName === district)
    return facilities
      .slice()
      .sort((a, b) => a.hospcode.localeCompare(b.hospcode))
  }, [snapshot, district])

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
  }, [snapshot, district, effectiveFacilityCode, search])

  const selectedFacility = useMemo(
    () =>
      effectiveFacilityCode === ALL_FACILITIES
        ? null
        : snapshot.facilities.find((f) => f.hospcode === effectiveFacilityCode) ?? null,
    [snapshot, effectiveFacilityCode],
  )

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
  }, [showTrendChart, otherDates, snapshot, district, effectiveFacilityCode, fiscalYear])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
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
        <KpiCard label={`OP รวม (ปีงบ ${fiscalYear})`} value={kpis.totalOp.toLocaleString('th-TH')} />
        <KpiCard
          label={`ผู้รับบริการ Telemedicine รวม (ปีงบ ${fiscalYear})`}
          value={kpis.totalTelemed.toLocaleString('th-TH')}
        />
        <KpiCard label="ร้อยละ Telemedicine ต่อ OP" value={`${kpis.percent.toFixed(1)}%`} accent />
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
                      <Bar dataKey="value" name="ผู้รับบริการ Telemedicine" fill="#0d9488" radius={[6, 6, 0, 0]} />
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
                      <Cell key={entry.type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                <th className="px-3 py-2 text-right font-medium">OP รวม</th>
                <th className="px-3 py-2 text-right font-medium">Type2</th>
                <th className="px-3 py-2 text-right font-medium">Type3</th>
                <th className="px-3 py-2 text-right font-medium">Type5</th>
                <th className="px-3 py-2 text-right font-medium">รวม Telemedicine</th>
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
                    <td className="px-3 py-2 text-slate-600">{f.hospcode}</td>
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
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
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

export default SnapshotView
