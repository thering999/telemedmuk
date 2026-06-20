import { useMemo } from 'react'
import type { Facility, ReportCategory } from '../types/hdc'

export interface FilterState {
  /** Free-text query matched against hospcode and hospname (case-insensitive). */
  search: string
  /** Inclusive ISO date (YYYY-MM-DD) lower bound, or '' for no lower bound. */
  dateFrom: string
  /** Inclusive ISO date (YYYY-MM-DD) upper bound, or '' for no upper bound. */
  dateTo: string
  /** Selected data-type quick filter, or null for "all types". */
  type: ReportCategory | null
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  type: null,
}

export function hasActiveFilters(filters: FilterState): boolean {
  return Boolean(filters.search || filters.dateFrom || filters.dateTo || filters.type)
}

/**
 * Filters a snapshot's facility records by free-text search (hospcode /
 * hospname), snapshot date range, and an optional data-type quick filter.
 * `snapshotDate` and `availableTypes` describe the single snapshot the
 * `records` array was loaded from — the date range narrows to "all records"
 * or "none" since every record in one snapshot shares the same date, and the
 * type filter narrows to "all" or "none" the same way, since the category is
 * a property of which JSON file was fetched, not of individual records.
 */
export function useFilteredData(
  records: Facility[],
  snapshotDate: string | null,
  availableTypes: ReportCategory[],
  filters: FilterState,
) {
  return useMemo(() => {
    const inDateRange =
      !snapshotDate ||
      ((!filters.dateFrom || snapshotDate >= filters.dateFrom) &&
        (!filters.dateTo || snapshotDate <= filters.dateTo))
    const inType = !filters.type || availableTypes.includes(filters.type)

    if (!inDateRange || !inType) return []

    const q = filters.search.trim().toLowerCase()
    if (!q) return records

    return records.filter(
      (r) => r.hospcode.toLowerCase().includes(q) || r.hospname.toLowerCase().includes(q),
    )
  }, [records, snapshotDate, availableTypes, filters])
}
