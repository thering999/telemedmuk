import type { Facility, FiscalYear, Snapshot } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'

/**
 * Data-quality validation for a parsed Hippo "base" snapshot, run client-side
 * right after parseHippoExcelFile() succeeds. This is a second, independent
 * pass over the already-parsed Snapshot — parseHippoExcelFile() only checks
 * structural sanity (has a sheet, has a hospcode column at all); this module
 * checks whether the data inside looks complete/sane enough to publish.
 *
 * Intentionally vanilla JS/TS only (no validation library): the checks here
 * are simple field presence/type/range checks that don't warrant a schema
 * library, and keeping this dependency-free matches the project's small,
 * hand-rolled-parsing style (see parseHippoExcel.ts).
 */

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  /** Short machine-friendly code, useful for tests/grouping (e.g. dedup by code). */
  code: string
  /** Thai, user-facing message — shown directly in the import UI. */
  message: string
}

export interface ValidationReport {
  /** No 'error'-severity issues -> file is safe to save. Warnings never block saving. */
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  stats: {
    rowCount: number
    /** Earliest/latest fiscal year actually carrying data across all rows, or null if none. */
    dateRange: { earliest: string; latest: string } | null
    /** % of (row × required-field) cells that are filled in, 0-100, rounded. */
    completenessPercent: number
    missingColumns: string[]
    /** e.g. "hospcode: 3 แถวพบค่าที่ไม่ใช่ตัวเลข" */
    typeMismatches: string[]
  }
}

/** Columns every "base" row is expected to carry (post-transform Facility field names). */
const REQUIRED_FACILITY_FIELDS: Array<keyof Facility> = [
  'hospcode',
  'hospname',
  'ampCode',
  'ampName',
  'hostypeCode',
  'hostypeName',
]

/** Facility fields expected to be present/non-empty for "completeness %". */
const COMPLETENESS_FIELDS: Array<keyof Facility> = [
  'hospcode',
  'hospname',
  'ampCode',
  'ampName',
  'hostypeCode',
  'hostypeName',
  'serviceAll',
  'opAll',
]

function isBlankString(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === ''
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Reasonable sanity bounds for a Hippo snapshotDate — outside this range is almost certainly a parsing/filename mistake. */
const MIN_REASONABLE_YEAR = 2015
const MAX_REASONABLE_YEAR_AHEAD = 1 // allow up to 1 year in the future for clock skew / early fiscal-year exports

function validateSnapshotDate(snapshotDate: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const parsed = new Date(`${snapshotDate}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    issues.push({
      severity: 'error',
      code: 'invalid_date',
      message: `วันที่ของไฟล์ไม่ถูกต้อง: "${snapshotDate}"`,
    })
    return issues
  }

  const now = new Date()
  const minDate = new Date(MIN_REASONABLE_YEAR, 0, 1)
  const maxDate = new Date(now.getFullYear() + MAX_REASONABLE_YEAR_AHEAD, now.getMonth(), now.getDate())

  if (parsed < minDate || parsed > maxDate) {
    issues.push({
      severity: 'warning',
      code: 'date_out_of_range',
      message: `วันที่ของไฟล์ (${snapshotDate}) ดูไม่สมเหตุสมผล — กรุณาตรวจสอบชื่อไฟล์`,
    })
  }

  return issues
}

/** Checks a single facility row for missing/null critical fields and type mismatches. Returns issues plus whether the row counts as "complete" for the completeness %. */
function validateFacilityRow(
  row: Facility,
  rowIndex: number,
): { issues: ValidationIssue[]; filledFieldCount: number } {
  const issues: ValidationIssue[] = []
  let filledFieldCount = 0

  for (const field of REQUIRED_FACILITY_FIELDS) {
    const value = row[field]
    if (isBlankString(value)) {
      issues.push({
        severity: 'error',
        code: `missing_${field}`,
        message: `แถวที่ ${rowIndex + 1}: ไม่มีค่าในคอลัมน์ "${field}"`,
      })
    }
  }

  if (!isFiniteNumber(row.serviceAll)) {
    issues.push({
      severity: 'warning',
      code: 'bad_type_serviceAll',
      message: `แถวที่ ${rowIndex + 1}: ค่า serviceAll ไม่ใช่ตัวเลข`,
    })
  }
  if (!isFiniteNumber(row.opAll)) {
    issues.push({
      severity: 'warning',
      code: 'bad_type_opAll',
      message: `แถวที่ ${rowIndex + 1}: ค่า opAll ไม่ใช่ตัวเลข`,
    })
  }
  if (!isFiniteNumber(row.percentTelemed69PerOP68)) {
    issues.push({
      severity: 'warning',
      code: 'bad_type_percent',
      message: `แถวที่ ${rowIndex + 1}: ค่า percentTelemed69PerOP68 ไม่ใช่ตัวเลข`,
    })
  }

  for (const field of COMPLETENESS_FIELDS) {
    const value = row[field]
    if (typeof value === 'string' ? value.trim() !== '' : isFiniteNumber(value)) {
      filledFieldCount += 1
    }
  }

  return { issues, filledFieldCount }
}

/** Finds the min/max fiscal year that actually has data (non-null byYear entry) across all rows, for the "date range" stat. */
function computeFiscalYearRange(facilities: Facility[]): { earliest: string; latest: string } | null {
  const yearsWithData = new Set<FiscalYear>()
  for (const facility of facilities) {
    for (const year of FISCAL_YEARS) {
      if (facility.byYear[year]) yearsWithData.add(year)
    }
  }
  if (yearsWithData.size === 0) return null
  const sorted = [...yearsWithData].sort()
  return { earliest: sorted[0], latest: sorted[sorted.length - 1] }
}

/**
 * Validate a parsed Snapshot's data quality/completeness. Pure function, no
 * I/O — safe to call synchronously right after parseHippoExcelFile().
 */
export function validateSnapshot(snapshot: Snapshot): ValidationReport {
  const issues: ValidationIssue[] = []
  const { facilities } = snapshot

  // Required-columns check: report once per missing column, not per row, so
  // a totally-missing column doesn't flood the report with one line per row.
  const missingColumns: string[] = []
  if (facilities.length > 0) {
    for (const field of REQUIRED_FACILITY_FIELDS) {
      const allBlank = facilities.every((f) => isBlankString(f[field]))
      if (allBlank) {
        missingColumns.push(field)
        issues.push({
          severity: 'error',
          code: `missing_column_${field}`,
          message: `ไม่พบคอลัมน์ "${field}" ในไฟล์นี้ (ทุกแถวว่าง)`,
        })
      }
    }
  } else {
    issues.push({
      severity: 'error',
      code: 'no_rows',
      message: 'ไฟล์นี้ไม่มีข้อมูลแถวใด ๆ',
    })
  }

  issues.push(...validateSnapshotDate(snapshot.snapshotDate))

  // Per-row checks only when at least the column skeleton is present —
  // otherwise every row would just repeat the same missing-column error.
  const typeMismatchCounts = new Map<string, number>()
  let totalFilledFieldCount = 0

  if (missingColumns.length === 0 && facilities.length > 0) {
    facilities.forEach((row, rowIndex) => {
      const { issues: rowIssues, filledFieldCount } = validateFacilityRow(row, rowIndex)
      totalFilledFieldCount += filledFieldCount
      for (const issue of rowIssues) {
        // Collapse per-row issues into one entry per code so the report stays
        // readable for files with many bad rows; row-level detail still goes
        // into the count.
        typeMismatchCounts.set(issue.code, (typeMismatchCounts.get(issue.code) ?? 0) + 1)
      }
    })

    const codeToLabel: Record<string, string> = {
      missing_hospcode: 'hospcode ว่าง',
      missing_hospname: 'hospname ว่าง',
      missing_ampCode: 'ampCode ว่าง',
      missing_ampName: 'ampName ว่าง',
      missing_hostypeCode: 'hostypeCode ว่าง',
      missing_hostypeName: 'hostypeName ว่าง',
      bad_type_serviceAll: 'serviceAll ไม่ใช่ตัวเลข',
      bad_type_opAll: 'opAll ไม่ใช่ตัวเลข',
      bad_type_percent: 'percentTelemed69PerOP68 ไม่ใช่ตัวเลข',
    }

    for (const [code, count] of typeMismatchCounts) {
      const severity: ValidationSeverity = code.startsWith('missing_') ? 'error' : 'warning'
      issues.push({
        severity,
        code,
        message: `${codeToLabel[code] ?? code}: พบ ${count} แถว`,
      })
    }
  }

  const dateRange = computeFiscalYearRange(facilities)
  if (missingColumns.length === 0 && facilities.length > 0 && !dateRange) {
    issues.push({
      severity: 'warning',
      code: 'no_year_data',
      message: 'ไม่พบข้อมูลปีงบประมาณใดเลยในไฟล์นี้ (ไม่มีคอลัมน์ Telemed/OP/Service รายปี)',
    })
  }

  const completenessPercent =
    facilities.length > 0 && COMPLETENESS_FIELDS.length > 0
      ? Math.round((totalFilledFieldCount / (facilities.length * COMPLETENESS_FIELDS.length)) * 100)
      : 0

  if (facilities.length > 0 && completenessPercent < 80) {
    issues.push({
      severity: 'warning',
      code: 'low_completeness',
      message: `ข้อมูลครบถ้วนเพียง ${completenessPercent}% (น้อยกว่า 80%) กรุณาตรวจสอบไฟล์ต้นทาง`,
    })
  }

  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  // typeMismatches stat: human-readable list pulled from the warning-level
  // bad_type_* issues specifically (kept separate from the general warnings
  // list so the UI can show a focused "ชนิดข้อมูลไม่ตรง" section).
  const typeMismatches = warnings
    .filter((w) => w.code.startsWith('bad_type_'))
    .map((w) => w.message)

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      rowCount: facilities.length,
      dateRange,
      completenessPercent,
      missingColumns,
      typeMismatches,
    },
  }
}
