import * as XLSX from 'xlsx'
import type { Facility, Snapshot } from '../types/hdc'

// Filename pattern: YYYYMMDD_PP_telemed_hosp[_NNN].xlsx (same as scripts/import-xlsx.mjs)
// The trailing running-number suffix is optional since not every Hippo export includes one.
const FILENAME_PATTERN = /^(\d{4})(\d{2})(\d{2})_(\d{2})_telemed_hosp(?:_\d+)?\.xlsx$/i

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

/** Transform a single raw worksheet row into the per-facility JSON shape. */
function transformRow(row: RawRow): Facility {
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
    byYear: {
      '68': {
        type2: toNumber(row.Type2_68),
        type3: toNumber(row.Type3_68),
        type5: toNumber(row.Type5_68),
        op: toNumber(row.OP68),
      },
      '69': {
        type2: toNumber(row.Type2_69),
        type3: toNumber(row.Type3_69),
        type5: toNumber(row.Type5_69),
        op: toNumber(row.OP69),
      },
    },
    percentTelemed69PerOP68: toNumber(row.PercentTelemed69PerOP68),
  }
}

export class ParseHippoExcelError extends Error {}

/**
 * Parse an uploaded Hippo telemedicine export (.xlsx, read client-side as an
 * ArrayBuffer) into a Snapshot. Lenient about the filename (falls back to
 * today's date / unknown province if it doesn't match the strict pipeline
 * pattern) but strict about basic structural sanity (must have a sheet, must
 * have at least one row with a hospcode) so obviously-wrong files produce a
 * clear error instead of a blank dashboard.
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
