import { useCallback, useEffect, useRef } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Facility, FiscalYear, Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { fullFiscalYear } from '../types/hdc'
import { useSnapshotTrend } from '../hooks/useSnapshotTrend'
import { formatThaiDate } from '../lib/formatThaiDate'

interface Props {
  facility: Facility
  snapshot: Snapshot
  snapshotIndex?: SnapshotIndexEntry[]
  fiscalYear: FiscalYear
  onClose: () => void
}

const n = (v: number | undefined) => (v == null ? '-' : v.toLocaleString('th-TH'))
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(2)}%` : '-')

/** Side panel drill-down for one facility: every fiscal year + cross-snapshot trend. */
export default function FacilityDetailDrawer({ facility, snapshot, snapshotIndex, fiscalYear, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const include = useCallback((f: Facility) => f.hospcode === facility.hospcode, [facility.hospcode])
  const { enabled, state } = useSnapshotTrend(snapshot, snapshotIndex, fiscalYear, include)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const years = Object.keys(facility.byYear).sort()
  const hasTypes = years.some((y) => facility.byYear[y]?.type5 != null)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="facility-drawer-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-slate-900/40" onClick={onClose} tabIndex={-1} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="facility-drawer-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {facility.hospname}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              รหัส {facility.hospcode} · {facility.hostypeName} · อ.{facility.ampName}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ปิด ✕
          </button>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">ข้อมูลรายปีงบประมาณ</h3>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <th className="px-2 py-2">ปีงบ</th>
                <th className="px-2 py-2 text-right">OP</th>
                <th className="px-2 py-2 text-right">Telemed</th>
                <th className="px-2 py-2 text-right">% ปีเดียวกัน</th>
                {hasTypes && (
                  <>
                    <th className="px-2 py-2 text-right">Type2</th>
                    <th className="px-2 py-2 text-right">Type3</th>
                    <th className="px-2 py-2 text-right">Type5</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const s = facility.byYear[y]!
                return (
                  <tr
                    key={y}
                    className={`border-b border-slate-100 dark:border-slate-800 ${y === fiscalYear ? 'bg-blue-50 font-semibold dark:bg-slate-800' : ''} text-slate-800 dark:text-slate-100`}
                  >
                    <td className="px-2 py-2">{fullFiscalYear(y)}</td>
                    <td className="px-2 py-2 text-right">{n(s.op)}</td>
                    <td className="px-2 py-2 text-right">{n(s.telemed)}</td>
                    <td className="px-2 py-2 text-right">{pct(s.telemed, s.op)}</td>
                    {hasTypes && (
                      <>
                        <td className="px-2 py-2 text-right">{n(s.type2)}</td>
                        <td className="px-2 py-2 text-right">{n(s.type3)}</td>
                        <td className="px-2 py-2 text-right">{n(s.type5)}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          แนวโน้ม Telemed ปีงบ {fullFiscalYear(fiscalYear)} ข้าม snapshot
        </h3>
        {!enabled && <p className="text-sm text-slate-500">มี snapshot เดียว ยังไม่มีแนวโน้มให้ดู</p>}
        {enabled && state.status === 'loading' && <p className="text-sm text-slate-500">กำลังโหลด…</p>}
        {enabled && state.status === 'error' && <p className="text-sm text-red-600">โหลดไม่สำเร็จ: {state.message}</p>}
        {enabled && state.status === 'ready' && (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={state.points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={formatThaiDate} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  labelFormatter={(d) => formatThaiDate(String(d))}
                  formatter={(v) => Number(v ?? 0).toLocaleString('th-TH')}
                />
                <Line type="monotone" dataKey="telemed" name="Telemed" stroke="#0d9488" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
