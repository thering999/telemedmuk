import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

/** Generic click-to-sort state for a table. Pass the already-filtered rows in;
 * get back the sorted rows plus a `toggleSort(key, accessor)` to wire onto
 * each clickable column header. Clicking the active column flips direction;
 * clicking a different column switches to it (ascending first). */
export function useSortableTable<T>(rows: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [accessor, setAccessor] = useState<((row: T) => string | number) | null>(null)

  const sortedRows = useMemo(() => {
    if (!accessor) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'th')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, accessor, sortDir])

  const toggleSort = (key: string, nextAccessor: (row: T) => string | number) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setAccessor(() => nextAccessor)
      setSortDir('asc')
    }
  }

  return { sortedRows, sortKey, sortDir, toggleSort }
}
