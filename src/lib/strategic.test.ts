import { describe, expect, it } from 'vitest'
import { classifyQuadrant, median, officialRate } from './strategic'

const stats = (op: number, type5: number) => ({ service: 0, op, type1: 0, type2: 0, type3: 0, type4: 0, type5 })

describe('officialRate', () => {
  it('is Type5 / OP * 100', () => {
    expect(officialRate(stats(200, 50))).toBe(25)
  })
  it('is null without data or OP', () => {
    expect(officialRate(undefined)).toBeNull()
    expect(officialRate(stats(0, 5))).toBeNull()
  })
})

describe('median', () => {
  it.each([
    [[], 0],
    [[3], 3],
    [[5, 1, 3], 3],
    [[4, 1, 3, 2], 2.5],
  ])('%j -> %d', (xs, m) => expect(median(xs)).toBe(m))
})

describe('classifyQuadrant', () => {
  it('splits on median OP and rate (inclusive)', () => {
    expect(classifyQuadrant(10, 10, 10, 10)).toBe('champions')
    expect(classifyQuadrant(10, 5, 10, 10)).toBe('sleepingGiants')
    expect(classifyQuadrant(5, 10, 10, 10)).toBe('activeSmall')
    expect(classifyQuadrant(5, 5, 10, 10)).toBe('waitingForSupport')
  })
})
