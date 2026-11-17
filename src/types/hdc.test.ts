import { describe, expect, it } from 'vitest'
import {
  detectFiscalYearsFromRow,
  fiscalYearFromDate,
  fullFiscalYear,
  previousFiscalYear,
  resolveFiscalYears,
} from './hdc'
import { applyFiscalYearSelection } from '../context/FiscalYearContext'

describe('fiscalYearFromDate', () => {
  it.each([
    ['2026-09-30', '69'],
    ['2026-10-01', '70'],
    ['2027-01-15', '70'],
    ['2027-10-01', '71'],
  ])('%s -> FY%s', (date, fy) => {
    expect(fiscalYearFromDate(date)).toBe(fy)
  })
})

describe('previousFiscalYear / fullFiscalYear', () => {
  it('wraps around the century', () => {
    expect(previousFiscalYear('70')).toBe('69')
    expect(previousFiscalYear('00')).toBe('99')
  })
  it('formats BE label', () => {
    expect(fullFiscalYear('70')).toBe('2570')
  })
})

describe('detectFiscalYearsFromRow', () => {
  it('finds years from column names, ascending, ignoring others', () => {
    const row = { Type2_70: 1, OP69: 2, Telemed68: 3, PersonAll70: 4, hoscode: 'x', Total_Visits_71: 0 }
    expect(detectFiscalYearsFromRow(row)).toEqual(['68', '69', '70', '71'])
  })
})

describe('resolveFiscalYears', () => {
  it('picks latest year with data', () => {
    const items = [{ byYear: { '68': {}, '69': {}, '70': undefined } }]
    expect(resolveFiscalYears(items)).toEqual({ current: '69', previous: '68', all: ['68', '69'] })
  })
  it('falls back to snapshot date when empty', () => {
    expect(resolveFiscalYears([], '2026-11-06').current).toBe('70')
  })
})

describe('applyFiscalYearSelection', () => {
  const base = { current: '70', previous: '69', all: ['68', '69', '70'] }
  it('auto selection keeps base', () => {
    expect(applyFiscalYearSelection(base, { current: null, previous: null })).toEqual(base)
  })
  it('honours valid pick', () => {
    expect(applyFiscalYearSelection(base, { current: '69', previous: '68' })).toEqual({ ...base, current: '69', previous: '68' })
  })
  it('ignores year without data and baseline not earlier than current', () => {
    expect(applyFiscalYearSelection(base, { current: '75', previous: '70' })).toEqual(base)
  })
})
