export interface SnapshotIndexEntry {
  date: string
  /**
   * Single filename when only one source file covers this date, or an array
   * of filenames (in merge order) when multiple same-date Hippo exports were
   * combined into one snapshot at the facility level.
   */
  sourceFile: string | string[]
  facilityCount: number
}

export interface YearStats {
  /** Total telemed-service count for the year — always populated. */
  telemed: number
  /** Visit-count denominator for the year (OP preferred, Service as fallback). */
  op: number
  /** Only present when the source format breaks telemed down by type. */
  type2?: number
  type3?: number
  type5?: number
}

export interface Facility {
  hospcode: string
  hospname: string
  ampCode: string
  ampName: string
  hostypeCode: string
  hostypeName: string
  mcode: string
  mName: string
  depName: string | null
  serviceAll: number
  opAll: number
  /**
   * A fiscal year with NO data at all in the source file (e.g. Format C's
   * missing "68") is omitted here entirely, rather than filled with a
   * fabricated all-zero entry — so downstream code can distinguish "no data
   * for this year" from "real zero usage."
   */
  byYear: Partial<Record<FiscalYear, YearStats>>
  percentTelemed69PerOP68: number
}

export interface Snapshot {
  snapshotDate: string
  /**
   * Single filename when only one source file covers this date, or an array
   * of filenames (in merge order) when multiple same-date Hippo exports were
   * combined into one snapshot at the facility level.
   */
  sourceFile: string | string[]
  province: {
    code: string
    name: string
  }
  facilities: Facility[]
}

export const FISCAL_YEARS = ['68', '69'] as const
export type FiscalYear = (typeof FISCAL_YEARS)[number]

export function telemedVisits(stats: YearStats | undefined): number {
  return stats?.telemed ?? 0
}
