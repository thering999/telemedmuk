import { useEffect, useMemo, useState } from 'react'
import type { Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { telemedVisits } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import { exportToCsv, type ExportColumn } from '../lib/exportTable'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

interface MetricRow {
  key: string
  label: string
  a: number
  b: number
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: Snapshot }

function useSnapshotByDate(date: string | null): FetchState {
  const [state, setState] = useState<FetchState>({ status: 'idle' })

  useEffect(() => {
    if (!date) return
    let cancelled = false
    // Defer the "loading" transition to a microtask so it's not a
    // synchronous setState call in the effect body (mirrors the same
    // pattern used by SnapshotView's trend-chart effect).
    Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'loading' })
    })
    fetch(dataUrl(`${date}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Snapshot>
      })
      .then((snapshot) => {
        if (!cancelled) setState({ status: 'ready', snapshot })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [date])

  return state
}

function buildRows(a: Snapshot, b: Snapshot): MetricRow[] {
  const sumOp68 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + (f.byYear['68']?.op ?? 0), 0)
  const sumOp69 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + (f.byYear['69']?.op ?? 0), 0)
  const sumTelemed69 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + telemedVisits(f.byYear['69']), 0)
  const sumType2 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + (f.byYear['69']?.type2 ?? 0), 0)
  const sumType3 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + (f.byYear['69']?.type3 ?? 0), 0)
  const sumType5 = (s: Snapshot) => s.facilities.reduce((sum, f) => sum + (f.byYear['69']?.type5 ?? 0), 0)
  const percentCoverage = (s: Snapshot) => {
    const op = sumOp68(s)
    const telemed = sumTelemed69(s)
    return op > 0 ? (telemed / op) * 100 : 0
  }
  const facilityCount = (s: Snapshot) => s.facilities.length

  return [
    { key: 'op68', label: 'OP รวม (ปีงบ 68)', a: sumOp68(a), b: sumOp68(b) },
    { key: 'op69', label: 'OP รวม (ปีงบ 69)', a: sumOp69(a), b: sumOp69(b) },
    { key: 'telemed69', label: 'ผู้รับบริการ Telemedicine รวม (ปีงบ 69)', a: sumTelemed69(a), b: sumTelemed69(b) },
    { key: 'type2', label: 'Type2 (นัดหมาย/ส่งต่อ)', a: sumType2(a), b: sumType2(b) },
    { key: 'type3', label: 'Type3 (เชิงรุก/ชุมชน)', a: sumType3(a), b: sumType3(b) },
    { key: 'type5', label: 'Type5 (โทรเวชกรรม)', a: sumType5(a), b: sumType5(b) },
    { key: 'percent', label: 'ร้อยละ OP68 เทียบ Telemed69', a: percentCoverage(a), b: percentCoverage(b) },
    { key: 'facilities', label: 'จำนวนสถานบริการ', a: facilityCount(a), b: facilityCount(b) },
  ]
}

function delta(row: MetricRow): { abs: number; pct: number | null } {
  const abs = row.b - row.a
  const pct = row.a !== 0 ? (abs / row.a) * 100 : null
  return { abs, pct }
}

function formatValue(key: string, value: number): string {
  if (key === 'percent') return `${value.toFixed(1)}%`
  return value.toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

function TrendBadge({ abs }: { abs: number }) {
  if (abs === 0) {
    return <span className="text-slate-400 dark:text-slate-500">•</span>
  }
  if (abs > 0) {
    return <span className="font-medium text-emerald-600 dark:text-emerald-400">↑ เพิ่มขึ้น</span>
  }
  return <span className="font-medium text-rose-600 dark:text-rose-400">↓ ลดลง</span>
}

export interface ComparisonViewProps {
  snapshotIndex: SnapshotIndexEntry[]
}

function ComparisonView({ snapshotIndex }: ComparisonViewProps) {
  const sortedDates = useMemo(
    () => snapshotIndex.map((e) => e.date).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    [snapshotIndex],
  )

  const [dateA, setDateA] = useState<string>(sortedDates[0] ?? '')
  const [dateB, setDateB] = useState<string>(sortedDates[sortedDates.length - 1] ?? '')

  const stateA = useSnapshotByDate(dateA || null)
  const stateB = useSnapshotByDate(dateB || null)

  const rows = useMemo(() => {
    if (stateA.status !== 'ready' || stateB.status !== 'ready') return []
    return buildRows(stateA.snapshot, stateB.snapshot)
  }, [stateA, stateB])

  const exportColumns = useMemo<ExportColumn<MetricRow>[]>(
    () => [
      { key: 'metric', label: 'ตัวชี้วัด', value: (r) => r.label },
      { key: 'a', label: `ช่วง A (${formatThaiDate(dateA)})`, value: (r) => Number(r.a.toFixed(2)) },
      { key: 'b', label: `ช่วง B (${formatThaiDate(dateB)})`, value: (r) => Number(r.b.toFixed(2)) },
      { key: 'change', label: 'เปลี่ยนแปลง', value: (r) => Number(delta(r).abs.toFixed(2)) },
      {
        key: 'pctchange',
        label: 'ร้อยละการเปลี่ยนแปลง',
        value: (r) => {
          const pct = delta(r).pct
          return pct === null ? 'N/A' : Number(pct.toFixed(2))
        },
      },
    ],
    [dateA, dateB],
  )

  if (sortedDates.length < 2) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        ต้องมีข้อมูลอย่างน้อย 2 ช่วงเวลาเพื่อเปรียบเทียบ
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 px-5 py-4 shadow-md dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
        <div className="flex flex-col gap-1">
          <label htmlFor="period-a" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            ช่วงเวลา A
          </label>
          <select
            id="period-a"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={dateA}
            onChange={(e) => setDateA(e.target.value)}
          >
            {sortedDates.map((d) => (
              <option key={d} value={d}>
                {formatThaiDate(d)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="period-b" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            ช่วงเวลา B
          </label>
          <select
            id="period-b"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={dateB}
            onChange={(e) => setDateB(e.target.value)}
          >
            {sortedDates.map((d) => (
              <option key={d} value={d}>
                {formatThaiDate(d)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          disabled={rows.length === 0}
          onClick={() => exportToCsv(`เปรียบเทียบ_${dateA}_vs_${dateB}`, exportColumns, rows)}
        >
          ส่งออก CSV
        </button>
      </div>

      {(stateA.status === 'loading' || stateB.status === 'loading') && (
        <p className="text-center text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูล...</p>
      )}
      {stateA.status === 'error' && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          เกิดข้อผิดพลาดในการโหลดช่วง A: {stateA.message}
        </p>
      )}
      {stateB.status === 'error' && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          เกิดข้อผิดพลาดในการโหลดช่วง B: {stateB.message}
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
            เปรียบเทียบ {formatThaiDate(dateA)} กับ {formatThaiDate(dateB)}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-slate-700 dark:border-slate-600 dark:from-slate-700 dark:to-slate-700 dark:text-slate-200">
                  <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">ตัวชี้วัด</th>
                  <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">ช่วง A</th>
                  <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">ช่วง B</th>
                  <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">เปลี่ยนแปลง</th>
                  <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">% เปลี่ยนแปลง</th>
                  <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">แนวโน้ม</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { abs, pct } = delta(row)
                  const colorClass =
                    abs > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : abs < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-500 dark:text-slate-400'
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-slate-100 hover:bg-blue-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3 text-slate-800 font-medium dark:text-slate-100">{row.label}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatValue(row.key, row.a)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatValue(row.key, row.b)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${colorClass}`}>
                        {abs > 0 ? '+' : ''}
                        {formatValue(row.key, abs)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${colorClass}`}>
                        {pct === null ? 'N/A' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TrendBadge abs={abs} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComparisonView
