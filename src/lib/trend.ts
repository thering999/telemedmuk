/** A single up/down/flat trend indicator rendered next to a row's value.
 * Kept in its own tiny module (no jspdf/html2canvas imports) so components
 * that just need the arrow glyph for on-screen badges -- or to build the
 * `trend` callback they pass into exportPdf's dynamically-imported
 * exportToPdf() -- don't drag the PDF-rendering libraries into their chunk. */
export type TrendDirection = 'up' | 'down' | 'flat'

export function trendArrow(direction: TrendDirection): string {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '•'
}

export function trendFromDelta(delta: number): TrendDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}
