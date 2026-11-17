import type { KeyboardEvent } from 'react'

/** Props that make a table row open a drill-down by click or Enter/Space. */
export function drillRowProps(open: () => void) {
  return {
    onClick: open,
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    },
    tabIndex: 0,
    title: 'คลิกเพื่อดูรายละเอียด',
  }
}

export const DRILL_ROW_CLASS = 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'

export const fmtNum = (v: number | undefined | null) => (v == null ? '-' : v.toLocaleString('th-TH'))
export const fmtPct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(2)}%` : '-')
