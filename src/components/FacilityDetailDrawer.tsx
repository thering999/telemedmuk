import { useCallback } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Facility, FiscalYear, Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { fullFiscalYear } from '../types/hdc'
import { useSnapshotTrend } from '../hooks/useSnapshotTrend'
import { formatThaiDate } from '../lib/formatThaiDate'
import { fmtNum, fmtPct } from '../lib/drill'
import DetailDrawer, { DrawerSection, DrawerTable } from './DetailDrawer'

interface Props {
  facility: Facility
  snapshot: Snapshot
  snapshotIndex?: SnapshotIndexEntry[]
  fiscalYear: FiscalYear
  onClose: () => void
}

/** Drill-down for one base-category facility: every fiscal year + cross-snapshot trend. */
export default function FacilityDetailDrawer({ facility, snapshot, snapshotIndex, fiscalYear, onClose }: Props) {
  const include = useCallback((f: Facility) => f.hospcode === facility.hospcode, [facility.hospcode])
  const { enabled, state } = useSnapshotTrend(snapshot, snapshotIndex, fiscalYear, include)

  const years = Object.keys(facility.byYear).sort()
  const hasTypes = years.some((y) => facility.byYear[y]?.type5 != null)
  const head = ['ปีงบ', 'OP', 'Telemed', '% ปีเดียวกัน', ...(hasTypes ? ['Type2', 'Type3', 'Type5'] : [])]
  const rows = years.map((y) => {
    const s = facility.byYear[y]!
    return [
      fullFiscalYear(y),
      fmtNum(s.op),
      fmtNum(s.telemed),
      fmtPct(s.telemed, s.op),
      ...(hasTypes ? [fmtNum(s.type2), fmtNum(s.type3), fmtNum(s.type5)] : []),
    ]
  })

  return (
    <DetailDrawer
      title={facility.hospname}
      subtitle={`รหัส ${facility.hospcode} · ${facility.hostypeName} · อ.${facility.ampName}`}
      onClose={onClose}
    >
      <DrawerSection title="ข้อมูลรายปีงบประมาณ">
        <DrawerTable head={head} rows={rows} highlight={years.indexOf(fiscalYear)} />
      </DrawerSection>

      {snapshotIndex && (
        <DrawerSection title={`แนวโน้ม Telemed ปีงบ ${fullFiscalYear(fiscalYear)} ข้าม snapshot`}>
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
        </DrawerSection>
      )}
    </DetailDrawer>
  )
}
