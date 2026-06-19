import * as XLSX from 'xlsx'
import type { Facility, FiscalYear, ReportCategory, Snapshot, YearStats } from '../types/hdc'
import { FISCAL_YEARS } from '../types/hdc'

// Filename pattern: YYYYMMDD_PP_telemed_hosp[_suffix][ (N)].xlsx (same as
// scripts/import-xlsx.mjs and worker/src/index.ts). The trailing suffix is
// optional and may be a running number (e.g. "_235") or a free-form tag
// (e.g. "_typein235" for the manually-typed-in subset export) since not
// every Hippo export includes one or uses the same scheme. The further
// optional " (N)"/"(N)" tolerates the suffix browsers add to a
// re-downloaded duplicate file (e.g. Chrome's "file (1).xlsx").
const FILENAME_PATTERN = /^(\d{4})(\d{2})(\d{2})_(\d{2})_telemed_hosp(?:_\w+)?(?: ?\(\d+\))?\.xlsx$/i

// Isolates just the optional "_suffix" group (without the trailing " (N)"
// dedup tag) so category rules can be applied independently of date parsing.
// Mirrors SUFFIX_PATTERN in scripts/import-xlsx.mjs — keep in sync.
const SUFFIX_PATTERN = /^\d{4}\d{2}\d{2}_\d{2}_telemed_hosp(_\w+)?(?: ?\(\d+\))?\.xlsx$/i

// Keep in sync with ReportCategory in src/types/hdc.ts. "typein" is kept
// separate from "base" since it's computed from a different notebook/formula
// (q_telemed_hosp-235.ipynb) than the master notebook's base/_NNN files.
const NEW_CATEGORIES: ReportCategory[] = ['all', 'person', 'ncd', 'mch', 'ltc_pal', 'followup', 'typein']

/**
 * Detect the report category from a Hippo export filename, mirroring the
 * same rules as scripts/import-xlsx.mjs's detectCategory():
 *  - no suffix, or "_NNN" (running number) -> "base"
 *  - "_typeinNNN" -> "typein" (own report, different formula)
 *  - "_all" / "_person" / "_ncd" / "_mch" / "_ltc_pal" / "_followup" -> that category
 *  - anything else (including filenames that don't match the base
 *    date/province/telemed_hosp shape at all) -> null, caller should reject.
 */
export function detectCategory(filename: string): ReportCategory | 'base' | null {
  const match = SUFFIX_PATTERN.exec(filename)
  if (!match) return null
  const suffix = match[1] as string | undefined // e.g. "_235", "_typein235", "_all", or undefined

  if (!suffix) return 'base'
  if (/^_\d+$/.test(suffix)) return 'base'
  if (/^_typein\d+$/.test(suffix)) return 'typein'

  const tag = suffix.slice(1) // drop leading underscore
  if (NEW_CATEGORIES.includes(tag as ReportCategory)) return tag as ReportCategory

  return null
}

const PROVINCE_NAMES: Record<string, string> = {
  '49': 'มุกดาหาร',
}

/** Trim a value if it's a string; pass through otherwise. */
function trimStr(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed
  }
  return value == null ? '' : String(value)
}

/**
 * Coerce a cell value into a number. Treats null/undefined/empty string as 0
 * for numeric usage-count fields (these columns represent counts, never
 * intentionally absent in the source data).
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Parse YYYYMMDD_PP_telemed_hosp_NNN.xlsx -> { snapshotDate, provinceCode }.
 * Returns null if the filename doesn't match the expected pattern (caller
 * should fall back to today's date leniently rather than reject the file).
 */
export function parseFilenameMeta(
  filename: string,
): { snapshotDate: string; provinceCode: string } | null {
  const match = FILENAME_PATTERN.exec(filename)
  if (!match) return null
  const [, yyyy, mm, dd, provinceCode] = match
  return {
    snapshotDate: `${yyyy}-${mm}-${dd}`,
    provinceCode,
  }
}

type RawRow = Record<string, unknown>

/**
 * Resolve a single fiscal year's YearStats from a raw row, supporting the 3
 * known Hippo export layouts:
 *  - Format A: Type2_Y / Type3_Y / Type5_Y + OP_Y (full type breakdown)
 *  - Format B: Telemed_Y total + OP_Y (no type breakdown)
 *  - Format C: Telemed_Y total + Service_Y as the OP fallback (no OP_Y at all)
 * A column "exists" if the row object has that key, even if its value is 0 —
 * only a truly absent key means the format doesn't track that metric.
 * Returns null if the format has no telemed AND no op/service data for this
 * year at all (year should be omitted from byYear entirely).
 */
function resolveYearStats(row: RawRow, year: FiscalYear): YearStats | null {
  const type2Key = `Type2_${year}`
  const type3Key = `Type3_${year}`
  const type5Key = `Type5_${year}`
  const telemedKey = `Telemed${year}`
  const opKey = `OP${year}`
  const serviceKey = `Service${year}`

  const hasTypeBreakdown = type2Key in row || type3Key in row || type5Key in row
  const hasTelemedTotal = telemedKey in row
  const hasOp = opKey in row
  const hasService = serviceKey in row

  if (!hasTypeBreakdown && !hasTelemedTotal && !hasOp && !hasService) {
    return null
  }

  const stats: YearStats = { telemed: 0, op: 0 }

  if (hasTypeBreakdown) {
    const type2 = toNumber(row[type2Key])
    const type3 = toNumber(row[type3Key])
    const type5 = toNumber(row[type5Key])
    stats.telemed = type2 + type3 + type5
    stats.type2 = type2
    stats.type3 = type3
    stats.type5 = type5
  } else if (hasTelemedTotal) {
    stats.telemed = toNumber(row[telemedKey])
  }

  if (hasOp) {
    stats.op = toNumber(row[opKey])
  } else if (hasService) {
    stats.op = toNumber(row[serviceKey])
  }

  return stats
}

/** Transform a single raw worksheet row into the per-facility JSON shape. */
function transformRow(row: RawRow): Facility {
  const byYear: Partial<Record<FiscalYear, YearStats>> = {}
  for (const year of FISCAL_YEARS) {
    const stats = resolveYearStats(row, year)
    if (stats) byYear[year] = stats
  }

  return {
    hospcode: trimStr(row.hospcode),
    hospname: trimStr(row.hospname),
    ampCode: trimStr(row.AMP_CODE),
    ampName: trimStr(row.AMP_NAME),
    hostypeCode: trimStr(row.HOSTYPECODE),
    hostypeName: trimStr(row.HOSTYPENAME),
    mcode: trimStr(row.MCODE),
    mName: trimStr(row.M_NAME),
    depName: trimStr(row.DEP_NAME) || null,
    serviceAll: toNumber(row.ServiceAll),
    opAll: toNumber(row.OPAll),
    byYear,
    percentTelemed69PerOP68: toNumber(row.PercentTelemed69PerOP68),
  }
}

export class ParseHippoExcelError extends Error {}

// Column names that, if present on the first row, positively identify a
// NEW (non-"base") category by its actual shape — used as a belt-and-
// suspenders check independent of the filename, so an uploaded file that's
// mislabeled (or matches the base filename pattern loosely) still gets
// rejected with a clear message instead of producing a wrong/empty preview.
// Order matters only for the log message; checks are independent.
const CATEGORY_SIGNATURE_COLUMNS: Array<{ category: ReportCategory; columns: string[] }> = [
  { category: 'all', columns: ['Type1_68_WalkIn', 'Type5_69_Telemed'] },
  { category: 'person', columns: ['PersonAll68', 'Person_Type5_69'] },
  { category: 'followup', columns: ['Total_Visits_69', 'FollowUp_Telemed'] },
  { category: 'ncd', columns: ['Visit_DM', 'Tele_DM'] },
  { category: 'mch', columns: ['Visit_ANC', 'Tele_ANC'] },
  { category: 'ltc_pal', columns: ['Visit_LTC', 'Tele_LTC'] },
]

/**
 * Inspect a row's actual columns to detect a NEW report category by shape,
 * independent of filename. Returns null if the row doesn't match any known
 * NEW category's signature columns (i.e. it looks like "base", or is simply
 * unrecognized — either way, the base transform path is allowed to proceed).
 */
function detectCategoryByColumns(row: RawRow): ReportCategory | null {
  for (const { category, columns } of CATEGORY_SIGNATURE_COLUMNS) {
    if (columns.every((col) => col in row)) return category
  }
  return null
}

/**
 * Parse an uploaded Hippo telemedicine export (.xlsx, read client-side as an
 * ArrayBuffer) into a Snapshot. Lenient about the filename (falls back to
 * today's date / unknown province if it doesn't match the strict pipeline
 * pattern) but strict about basic structural sanity (must have a sheet, must
 * have at least one row with a hospcode) so obviously-wrong files produce a
 * clear error instead of a blank dashboard.
 *
 * This ad hoc preview path only understands the "base" category's row shape.
 * If the uploaded file is shaped like one of the NEW categories (all/person/
 * ncd/mch/ltc_pal/followup) — detected by column presence, not just
 * filename — it is rejected with a clear Thai message pointing the user at
 * "บันทึกไปยัง GitHub" instead, rather than silently mis-parsing it.
 */
export function parseHippoExcelFile(buffer: ArrayBuffer, filename: string): Snapshot {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch (err) {
    throw new ParseHippoExcelError(
      `ไม่สามารถอ่านไฟล์ Excel นี้ได้: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new ParseHippoExcelError('ไฟล์นี้ไม่มีชีตข้อมูล (worksheet)')
  }
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: null, raw: true })

  if (rows.length === 0) {
    throw new ParseHippoExcelError('ไฟล์นี้ไม่มีข้อมูลแถวใด ๆ')
  }

  const detectedCategory = detectCategoryByColumns(rows[0])
  if (detectedCategory) {
    throw new ParseHippoExcelError(
      `ไฟล์นี้เป็นรายงานหมวด '${detectedCategory}' ซึ่งหน้านำเข้าเฉพาะกิจยังไม่รองรับการแสดงตัวอย่าง — กดปุ่ม 'บันทึกไปยัง GitHub' เพื่อเผยแพร่ข้อมูลนี้ได้ตามปกติ`,
    )
  }

  const facilities = rows.map(transformRow)

  const hasAnyHospcode = facilities.some((f) => f.hospcode)
  if (!hasAnyHospcode) {
    throw new ParseHippoExcelError(
      'ไม่พบคอลัมน์ที่คาดหวัง (เช่น hospcode) ในไฟล์นี้ กรุณาตรวจสอบว่าเป็นไฟล์ส่งออกจาก Hippo ที่ถูกต้อง',
    )
  }

  const meta = parseFilenameMeta(filename)
  const snapshotDate = meta?.snapshotDate ?? new Date().toISOString().slice(0, 10)
  const provinceCode = meta?.provinceCode ?? '49'
  const provinceName = PROVINCE_NAMES[provinceCode] ?? `(ไม่ทราบจังหวัด: ${provinceCode})`

  return {
    snapshotDate,
    sourceFile: filename,
    province: {
      code: provinceCode,
      name: provinceName,
    },
    facilities,
  }
}
