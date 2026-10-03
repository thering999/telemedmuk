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
  /**
   * False when this date's Hippo export cycle had no plain base file (no
   * Type2_Y/Type3_Y/Type5_Y/OP_Y breakdown) — only NEW-category data exists.
   * Client must not fetch <date>.json or show the "base" sub-tab for these.
   * Older index.json files predate this field, so treat undefined as true.
   */
  hasBase?: boolean
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
  /** Legacy precomputed column (FY69 telemed / FY68 OP) from older exports; compute from byYear instead. */
  percentTelemed69PerOP68?: number
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

/**
 * Two-digit Buddhist-era fiscal year key as it appears in Hippo column names
 * (e.g. "69" for ปีงบประมาณ 2569, "70" for 2570). Years are detected from the
 * data itself — never hardcode a specific year in UI code; use the helpers
 * below to resolve the current/previous year for a dataset.
 */
export type FiscalYear = string

// Matches every year-suffixed column family across all report categories:
// Type2_69, Type1_69_WalkIn, Telemed69, OP69, OP_Person69, Service69,
// PersonAll69, Person_Type5_69, Total_Visits_69.
const YEAR_COLUMN_PATTERN =
  /^(?:Type\d_|Telemed|OP_Person|OP|Service|PersonAll|Person_Type\d_|Total_Visits_)(\d{2})(?:_[A-Za-z]+)?$/

/** Fiscal years present in a raw Hippo row's column names, ascending. */
export function detectFiscalYearsFromRow(row: Record<string, unknown>): FiscalYear[] {
  const years = new Set<string>()
  for (const key of Object.keys(row)) {
    const m = YEAR_COLUMN_PATTERN.exec(key)
    if (m) years.add(m[1])
  }
  return [...years].sort()
}

/** Union of fiscal years carrying data across items with a byYear map, ascending. */
export function fiscalYearsOf(items: ReadonlyArray<{ byYear: Partial<Record<FiscalYear, unknown>> }>): FiscalYear[] {
  const years = new Set<string>()
  for (const item of items) {
    for (const [y, v] of Object.entries(item.byYear)) if (v != null) years.add(y)
  }
  return [...years].sort()
}

/** Thai fiscal year (2-digit BE) containing an ISO date; fiscal year starts 1 Oct. */
export function fiscalYearFromDate(isoDate: string): FiscalYear {
  const d = new Date(isoDate)
  const t = Number.isNaN(d.getTime()) ? new Date() : d
  const be = t.getFullYear() + 543 + (t.getMonth() >= 9 ? 1 : 0)
  return String(be % 100).padStart(2, '0')
}

export function previousFiscalYear(year: FiscalYear): FiscalYear {
  return String((Number(year) + 99) % 100).padStart(2, '0')
}

/** Full BE year label, e.g. "70" -> "2570". */
export function fullFiscalYear(year: FiscalYear): string {
  return `25${year}`
}

export interface FiscalYearPair {
  /** Latest year with data (falls back to the snapshot date's fiscal year). */
  current: FiscalYear
  /** Year before `current`, used as the comparison baseline. */
  previous: FiscalYear
  /** All years with data, ascending. */
  all: FiscalYear[]
}

/** Resolve current/previous fiscal year for a dataset. */
export function resolveFiscalYears(
  items: ReadonlyArray<{ byYear: Partial<Record<FiscalYear, unknown>> }>,
  snapshotDate?: string,
): FiscalYearPair {
  const all = fiscalYearsOf(items)
  const current = all[all.length - 1] ?? fiscalYearFromDate(snapshotDate ?? '')
  return { current, previous: previousFiscalYear(current), all }
}

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

export type ReportCategory = 'all' | 'person' | 'ncd' | 'mch' | 'ltc_pal' | 'followup' | 'typein'

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
  /** Total visits in the report's fiscal year (FollowupSnapshot.fiscalYear). */
  totalVisits: number
  /** Legacy field name from FY69-only snapshots; read via followupTotalVisits(). */
  totalVisits69?: number
  followUpTotal: number
  followUpNormal: number
  followUpTelemed: number
  percentTelemedUsage: number
}
export interface FollowupSnapshot {
  snapshotDate: string
  category: 'followup'
  /** Fiscal year the report covers; absent on legacy snapshots (= "69"). */
  fiscalYear?: FiscalYear
  sourceFile: string | string[]
  province: { code: string; name: string }
  facilities: FollowupFacility[]
}

export function followupFiscalYear(s: FollowupSnapshot): FiscalYear {
  return s.fiscalYear ?? '69'
}

export function followupTotalVisits(f: FollowupFacility): number {
  return f.totalVisits ?? f.totalVisits69 ?? 0
}
