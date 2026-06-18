export interface SnapshotIndexEntry {
  date: string
  sourceFile: string
  facilityCount: number
}

export interface YearStats {
  type2: number
  type3: number
  type5: number
  op: number
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
  byYear: Record<string, YearStats>
  percentTelemed69PerOP68: number
}

export interface Snapshot {
  snapshotDate: string
  sourceFile: string
  province: {
    code: string
    name: string
  }
  facilities: Facility[]
}

export const FISCAL_YEARS = ['68', '69'] as const
export type FiscalYear = (typeof FISCAL_YEARS)[number]

export function telemedVisits(stats: YearStats | undefined): number {
  if (!stats) return 0
  return stats.type2 + stats.type3 + stats.type5
}
