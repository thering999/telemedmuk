import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { detectCategory, parseFilenameMeta, parseHippoExcelFile, ParseHippoExcelError } from './parseHippoExcel'
import { validateSnapshot } from './validateSnapshot'

describe('detectCategory', () => {
  it.each([
    ['20261009_49_telemed_hosp.xlsx', 'base'],
    ['20261009_49_telemed_hosp_235.xlsx', 'base'],
    ['20261009_49_telemed_hosp_typein235.xlsx', 'typein'],
    ['20261009_49_telemed_hosp_all.xlsx', 'all'],
    ['20261009_49_telemed_hosp_ltc_pal.xlsx', 'ltc_pal'],
    ['20261009_49_telemed_hosp_followup.xlsx', 'followup'],
    ['20261009_49_telemed_hosp_bogus.xlsx', null],
    ['random.xlsx', null],
  ])('%s -> %s', (name, expected) => {
    expect(detectCategory(name)).toBe(expected)
  })
})

describe('parseFilenameMeta', () => {
  it('extracts date and province', () => {
    expect(parseFilenameMeta('20261009_49_telemed_hosp_all.xlsx')).toEqual({
      snapshotDate: '2026-10-09',
      provinceCode: '49',
    })
  })
  it('rejects non-matching names', () => {
    expect(parseFilenameMeta('report.xlsx')).toBeNull()
  })
})

function toBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return out
}

describe('parseHippoExcelFile', () => {
  it('throws on an empty sheet', () => {
    expect(() => parseHippoExcelFile(toBuffer([]), '20261009_49_telemed_hosp.xlsx')).toThrow(ParseHippoExcelError)
  })

  const rawDir = join(__dirname, '../../data/raw')
  const baseFiles = readdirSync(rawDir).filter((f) => detectCategory(f) === 'base')

  it.each(baseFiles)('parses committed export %s without validation errors', (file) => {
    const buf = readFileSync(join(rawDir, file))
    const snapshot = parseHippoExcelFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), file)
    expect(snapshot.snapshotDate).toBe(parseFilenameMeta(file)!.snapshotDate)
    const report = validateSnapshot(snapshot)
    expect(report.errors).toEqual([])
    expect(report.ok).toBe(true)
  })
})
