import type { FiscalYear, TypeYearStats } from '../types/hdc'

export type Quadrant = 'champions' | 'sleepingGiants' | 'activeSmall' | 'waitingForSupport'

export const QUADRANT_META: Record<Quadrant, { label: string; color: string }> = {
  champions: { label: 'Champions (ต้นแบบ)', color: '#0d9488' },
  sleepingGiants: { label: 'Sleeping Giants (ศักยภาพสูงที่ต้องกระตุ้น)', color: '#f59e0b' },
  activeSmall: { label: 'Active Small (จิ๋วแต่แจ๋ว)', color: '#2563eb' },
  waitingForSupport: { label: 'Waiting for Support (กลุ่มรอการสนับสนุน)', color: '#94a3b8' },
}

export const DISTRICT_TARGET_RATE = 30
export const RPST_TARGET_RATE = 10
export const RPST_HOSTYPE_MATCH = 'ส่งเสริมสุขภาพตำบล'

export interface CombinedFacility {
  hospcode: string
  hospname: string
  ampName: string
  hostypeName: string
  mName: string
  byYear: Partial<Record<FiscalYear, TypeYearStats>>
}

export function officialDenominator(stats: TypeYearStats | undefined): number {
  if (!stats) return 0
  return stats.op
}

/** Type5 (Telemedicine) ÷ OP × 100 — the same definition used everywhere else in this
 * dashboard (q_telemed_hosp_muk.ipynb's own convention), so this view's percentage reads
 * consistently with ภาพรวม/แยกประเภทบริการ instead of introducing a second, differently-scaled
 * "official" formula. Null when OP is 0 ("ไม่มีข้อมูล"), never NaN/0-by-force. */
export function officialRate(stats: TypeYearStats | undefined): number | null {
  if (!stats) return null
  const op = officialDenominator(stats)
  if (op <= 0) return null
  return (stats.type5 / op) * 100
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function classifyQuadrant(op: number, rate: number, medianOp: number, medianRate: number): Quadrant {
  const highOp = op >= medianOp
  const highRate = rate >= medianRate
  if (highOp && highRate) return 'champions'
  if (highOp && !highRate) return 'sleepingGiants'
  if (!highOp && highRate) return 'activeSmall'
  return 'waitingForSupport'
}
