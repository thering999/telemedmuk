import type { SortDirection } from '../lib/useSortableTable'

export interface SortableThProps {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
  colSpan?: number
}

/** Clickable <th> with a sort-direction indicator. Drop-in replacement for a
 * plain <th> in any facility table — pass through the same className so the
 * existing per-table styling (colors, padding, font weight) is preserved. */
function SortableTh({ label, active, direction, onClick, align = 'left', className = '', colSpan }: SortableThProps) {
  return (
    <th
      onClick={onClick}
      colSpan={colSpan}
      title="คลิกเพื่อเรียงลำดับ"
      className={`cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/10 ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <span className="text-[10px] opacity-60 dark:opacity-70">{active ? (direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}

export default SortableTh
