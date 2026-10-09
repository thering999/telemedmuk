import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  fullFiscalYear,
  previousFiscalYear,
  resolveFiscalYears,
  type FiscalYear,
  type FiscalYearPair,
} from '../types/hdc'

/**
 * App-wide fiscal year selection. `null` means "auto" (latest year with data,
 * compared against the year before it). Views resolve the selection against
 * the years their own dataset actually carries via `useFiscalYears`.
 */
export interface FiscalYearSelection {
  current: FiscalYear | null
  previous: FiscalYear | null
}

interface FiscalYearContextValue {
  selection: FiscalYearSelection
  setSelection: (s: FiscalYearSelection) => void
}

const STORAGE_KEY = 'telemedmuk.fiscalYearSelection'
const AUTO: FiscalYearSelection = { current: null, previous: null }

function loadSelection(): FiscalYearSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return AUTO
    const parsed = JSON.parse(raw) as Partial<FiscalYearSelection>
    const valid = (y: unknown): FiscalYear | null => (typeof y === 'string' && /^\d{2}$/.test(y) ? y : null)
    return { current: valid(parsed.current), previous: valid(parsed.previous) }
  } catch {
    return AUTO
  }
}

const FiscalYearContext = createContext<FiscalYearContextValue | null>(null)

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<FiscalYearSelection>(loadSelection)
  const value = useMemo<FiscalYearContextValue>(
    () => ({
      selection,
      setSelection: (s) => {
        setSelectionState(s)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
        } catch {
          // storage unavailable — selection still applies for this session
        }
      },
    }),
    [selection],
  )
  return <FiscalYearContext.Provider value={value}>{children}</FiscalYearContext.Provider>
}

export function useFiscalYearSelection(): FiscalYearContextValue {
  const ctx = useContext(FiscalYearContext)
  // Outside the provider (e.g. import preview) fall back to auto selection.
  return ctx ?? { selection: AUTO, setSelection: () => {} }
}

/** Apply a selection to a dataset's available years. Falls back to auto when the picked year has no data. */
export function applyFiscalYearSelection(base: FiscalYearPair, selection: FiscalYearSelection): FiscalYearPair {
  const current = selection.current && base.all.includes(selection.current) ? selection.current : base.current
  const previous =
    selection.previous && Number(selection.previous) < Number(current) ? selection.previous : previousFiscalYear(current)
  return { current, previous, all: base.all }
}

/** Drop-in replacement for `resolveFiscalYears` that honours the app-wide selection. */
export function useFiscalYears(
  items: ReadonlyArray<{ byYear: Partial<Record<FiscalYear, unknown>> }>,
  snapshotDate?: string,
): FiscalYearPair {
  const { selection } = useFiscalYearSelection()
  return useMemo(
    () => applyFiscalYearSelection(resolveFiscalYears(items, snapshotDate), selection),
    [items, snapshotDate, selection],
  )
}

/** Global picker: main fiscal year + comparison (baseline) year. */
export function FiscalYearPicker({ years }: { years: FiscalYear[] }) {
  const { selection, setSelection } = useFiscalYearSelection()
  if (years.length === 0) return null
  const effectiveCurrent =
    selection.current && years.includes(selection.current) ? selection.current : years[years.length - 1]
  // Baseline may be any earlier year, including ones without data in this dataset (shows as 0).
  const baselineOptions: FiscalYear[] = []
  for (let y = Number(effectiveCurrent) - 1; y >= Math.max(Number(years[0]) - 1, Number(effectiveCurrent) - 10); y--) {
    baselineOptions.push(String(y).padStart(2, '0'))
  }
  const selectCls =
    'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <label htmlFor="fy-current" className="font-medium">
        ปีงบประมาณ
      </label>
      <select
        id="fy-current"
        className={selectCls}
        value={selection.current ?? ''}
        onChange={(e) => setSelection({ current: e.target.value || null, previous: null })}
      >
        <option value="">ล่าสุด ({fullFiscalYear(years[years.length - 1])})</option>
        {[...years].reverse().map((y) => (
          <option key={y} value={y}>
            {fullFiscalYear(y)}
          </option>
        ))}
      </select>
      <label htmlFor="fy-previous" className="font-medium">
        เทียบกับ
      </label>
      <select
        id="fy-previous"
        className={selectCls}
        value={selection.previous ?? ''}
        onChange={(e) => setSelection({ ...selection, previous: e.target.value || null })}
      >
        <option value="">ปีก่อนหน้า ({fullFiscalYear(previousFiscalYear(effectiveCurrent))})</option>
        {baselineOptions.map((y) => (
          <option key={y} value={y}>
            {fullFiscalYear(y)}
          </option>
        ))}
      </select>
    </div>
  )
}
