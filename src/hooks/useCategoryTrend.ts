import { useEffect, useState } from 'react'
import type { ReportCategory, SnapshotIndexEntry } from '../types/hdc'

export type CategoryTrendState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; points: { date: string; value: number }[] }

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/snapshots/${path}`

// Per-session cache: category files are immutable per deploy, and the drawer
// re-mounts on every row click.
const cache = new Map<string, Promise<{ facilities: { hospcode: string }[] }>>()
function load(date: string, category: ReportCategory) {
  const key = `${date}/${category}`
  let p = cache.get(key)
  if (!p) {
    p = fetch(dataUrl(`${key}.json`)).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

/**
 * Trend of one facility's metric across every snapshot carrying `category`.
 * `value` must be stable (module-level or memoised); it returns null when the
 * metric doesn't apply to that snapshot (point is skipped).
 */
export function useCategoryTrend<F extends { hospcode: string }>(
  snapshotIndex: SnapshotIndexEntry[] | undefined,
  category: ReportCategory,
  hospcode: string,
  value: (f: F) => number | null,
): CategoryTrendState | null {
  const dates = (snapshotIndex ?? []).filter((e) => e.categories.includes(category)).map((e) => e.date)
  const datesKey = dates.join(',')
  const enabled = dates.length > 1
  const [state, setState] = useState<CategoryTrendState>({ status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all(
      datesKey.split(',').map((date) =>
        load(date, category).then((s) => {
          const f = s.facilities.find((x) => x.hospcode === hospcode) as F | undefined
          const v = f ? value(f) : null
          return v == null ? null : { date, value: v }
        }),
      ),
    )
      .then((pts) => {
        if (cancelled) return
        const points = pts.filter((p): p is { date: string; value: number } => p !== null).sort((a, b) => a.date.localeCompare(b.date))
        setState({ status: 'ready', points })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : 'โหลดไม่สำเร็จ' })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, datesKey, category, hospcode, value])

  return enabled ? state : null
}
