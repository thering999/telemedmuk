export interface SnapshotIndexEntry {
  date: string
  /**
   * Single filename when only one source file covers this date, or an array
   * of filenames (in merge order) when multiple same-date Hippo exports were
   * combined into one snapshot at the facility level.
   */
  sourceFile: string | string[]
  facilityCount: number
  /**
   * Which NEW report categories (beyond the always-present "base" category)
   * have a per-category JSON file for this date, under
   * public/data/snapshots/<date>/<category>.json. "base" is implied always
   * present and intentionally NOT included here.
   */
  categories: ReportCategory[]
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

// ---------------------------------------------------------------------------
// New report categories (beyond the original "base" category above). These
// share the same facility-identity columns (AMP_CODE, AMP_NAME, hospcode,
// hospname, HOSTYPECODE, HOSTYPENAME) but do NOT have MCODE/M_NAME/DEP_NAME.
// ---------------------------------------------------------------------------

export interface FacilityIdentity {
  hospcode: string
  hospname: string
  ampCode: string
  ampName: string
  hostypeCode: string
  hostypeName: string
}

export type ReportCategory = 'all' | 'person' | 'ncd' | 'mch' | 'ltc_pal' | 'followup'

export interface TypeYearStats {
  service: number
  op: number
  type1: number // Walk-in
  type2: number // Appointment/Refer
  type3: number // Community outreach
  type4: number // Home visit
  type5: number // Telemedicine
}
export interface TypeBreakdownFacility extends FacilityIdentity {
  byYear: Partial<Record<FiscalYear, TypeYearStats>>
}
export interface TypeBreakdownSnapshot {
  snapshotDate: string
  category: 'all' | 'person'
  sourceFile: string | string[]
  province: { code: string; name: string }
  facilities: TypeBreakdownFacility[]
}

export interface GroupStats {
  visit: number
  tele: number
}
export interface GroupDef {
  key: string
  label: string // Thai display label, e.g. "เบาหวาน"
}
export interface GroupBreakdownFacility extends FacilityIdentity {
  groups: Record<string, GroupStats>
  byYear: Partial<Record<FiscalYear, YearStats>> // reuse the EXISTING YearStats type (telemed/op/type2/3/5-optional) — for these categories type2/3/5 will simply stay undefined since the source has no breakdown for the overall Service/OP/Telemed columns, only telemed+op are populated
}
export interface GroupBreakdownSnapshot {
  snapshotDate: string
  category: 'ncd' | 'mch' | 'ltc_pal'
  sourceFile: string | string[]
  province: { code: string; name: string }
  groupDefs: GroupDef[] // tells the UI what groups exist and their Thai labels, so it never hardcodes per-category group lists
  facilities: GroupBreakdownFacility[]
}

export interface FollowupFacility extends FacilityIdentity {
  totalVisits69: number
  followUpTotal: number
  followUpNormal: number
  followUpTelemed: number
  percentTelemedUsage: number
}
export interface FollowupSnapshot {
  snapshotDate: string
  category: 'followup'
  sourceFile: string | string[]
  province: { code: string; name: string }
  facilities: FollowupFacility[]
}
