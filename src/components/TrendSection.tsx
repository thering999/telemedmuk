import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReportCategory, SnapshotIndexEntry } from '../types/hdc'
import { useCategoryTrend } from '../hooks/useCategoryTrend'
import { formatThaiDate } from '../lib/formatThaiDate'
import { DrawerSection } from './DetailDrawer'

interface Props<F extends { hospcode: string }> {
  title: string
  snapshotIndex?: SnapshotIndexEntry[]
  category: ReportCategory
  hospcode: string
  value: (f: F) => number | null
  unit?: string
}

/** Drawer section: one facility's metric across every snapshot of a category. */
export default function TrendSection<F extends { hospcode: string }>({
  title,
  snapshotIndex,
  category,
  hospcode,
  value,
  unit = '',
}: Props<F>) {
  const state = useCategoryTrend(snapshotIndex, category, hospcode, value)
  if (!state) return null
  return (
    <DrawerSection title={title}>
      {state.status === 'loading' && <p className="text-sm text-slate-500">กำลังโหลด…</p>}
      {state.status === 'error' && <p className="text-sm text-red-600">โหลดไม่สำเร็จ: {state.message}</p>}
      {state.status === 'ready' && state.points.length < 2 && (
        <p className="text-sm text-slate-500">ข้อมูลไม่พอสำหรับแสดงแนวโน้ม</p>
      )}
      {state.status === 'ready' && state.points.length >= 2 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={state.points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={formatThaiDate} tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} unit={unit} />
              <Tooltip
                labelFormatter={(d) => formatThaiDate(String(d))}
                formatter={(v) => `${Number(v ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}${unit}`}
              />
              <Line type="monotone" dataKey="value" name={title} stroke="#0d9488" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </DrawerSection>
  )
}
