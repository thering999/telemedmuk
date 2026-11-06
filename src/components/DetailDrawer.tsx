import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/** Right-side modal panel used by every drill-down. Esc / backdrop / button close it. */
export default function DetailDrawer({ title, subtitle, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="detail-drawer-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-slate-900/40" onClick={onClose} tabIndex={-1} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="detail-drawer-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ปิด ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

/** Simple striped table: header labels + rows of cells (first column left-aligned, rest right). */
export function DrawerTable({ head, rows, highlight }: { head: string[]; rows: ReactNode[][]; highlight?: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {head.map((h, i) => (
            <th key={h} className={`px-2 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, r) => (
          <tr
            key={r}
            className={`border-b border-slate-100 text-slate-800 dark:border-slate-800 dark:text-slate-100 ${r === highlight ? 'bg-blue-50 font-semibold dark:bg-slate-800' : ''}`}
          >
            {cells.map((c, i) => (
              <td key={i} className={`px-2 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
