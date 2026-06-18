import { useEffect, useState } from 'react'
import type { Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { formatThaiDate } from '../lib/formatThaiDate'
import SnapshotView from './SnapshotView'

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
      </div>

      {currentError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          เกิดข้อผิดพลาดในการโหลดสแนปช็อต: {currentError}
        </p>
      )}

      {(!snapshot || isStale) && !currentError && (
        <p className="text-center text-slate-500">กำลังโหลดข้อมูลสแนปช็อต...</p>
      )}

      {snapshot && !isStale && <SnapshotView snapshot={snapshot} snapshotIndex={index} />}
    </div>
  )
}

export default HdcTab
