import { useEffect, useMemo, useState } from 'react'
import type { Facility, FiscalYear, Snapshot, SnapshotIndexEntry } from '../types/hdc'
import { telemedVisits } from '../types/hdc'

export type SnapshotTrendState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; points: { date: string; telemed: number }[] }

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

/**
 * Multi-snapshot telemed trend for the facilities matching `include`. Only
 * meaningful when the index lists more than one snapshot; fetches the other
 * snapshots lazily. `include` must be memoised by the caller (it's an effect dep).
 */
export function useSnapshotTrend(
  snapshot: Snapshot,
  snapshotIndex: SnapshotIndexEntry[] | undefined,
  fiscalYear: FiscalYear,
  include: (f: Facility) => boolean,
): { enabled: boolean; state: SnapshotTrendState } {
  const [state, setState] = useState<SnapshotTrendState>({ status: 'idle' })

  const otherDates = useMemo(() => {
    if (!snapshotIndex || snapshotIndex.length <= 1) return []
    return snapshotIndex.map((e) => e.date).filter((d) => d !== snapshot.snapshotDate)
  }, [snapshotIndex, snapshot.snapshotDate])

  const enabled = Boolean(snapshotIndex && snapshotIndex.length > 1)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    // Defer the "loading" transition to a microtask so it's not a
    // synchronous setState call in the effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'loading' })
    })

    const telemedFor = (s: Snapshot) =>
      s.facilities.reduce((sum, f) => (include(f) ? sum + telemedVisits(f.byYear[fiscalYear]) : sum), 0)

    Promise.all(
      otherDates.map((date) =>
        fetch(dataUrl(`${date}.json`))
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json() as Promise<Snapshot>
          })
          .then((s) => ({ date, telemed: telemedFor(s) })),
      ),
    )
      .then((others) => {
        if (cancelled) return
        const points = [...others, { date: snapshot.snapshotDate, telemed: telemedFor(snapshot) }].sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
        )
        setState({ status: 'ready', points })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลแนวโน้มได้',
        })
      })

    return () => {
      cancelled = true
    }
  }, [enabled, otherDates, snapshot, include, fiscalYear])

  return { enabled, state }
}
