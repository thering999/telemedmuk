export interface KpiCardProps {
  label: string
  value: string
  variant?: 'default' | 'accent' | 'danger'
  /** Small badge shown top-right, e.g. "หลัก". */
  description?: string
  /** Small caption shown under the value. */
  footnote?: string
}

const VARIANT_STYLES: Record<NonNullable<KpiCardProps['variant']>, { border: string; bg: string; value: string }> = {
  default: {
    border: 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500',
    bg: 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800',
    value: 'text-slate-900 dark:text-slate-100',
  },
  accent: {
    border: 'border-cyan-400 dark:border-cyan-600',
    bg: 'bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50 dark:from-cyan-950/30 dark:via-teal-950/30 dark:to-emerald-950/30',
    value: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-teal-600',
  },
  danger: {
    border: 'border-rose-300 dark:border-rose-700',
    bg: 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-slate-800',
    value: 'text-rose-600 dark:text-rose-400',
  },
}

function KpiCard({ label, value, variant = 'default', description, footnote }: KpiCardProps) {
  const styles = VARIANT_STYLES[variant]
  return (
    <div className={`rounded-xl border-2 p-6 shadow-md transition-all hover:shadow-xl hover:scale-105 ${styles.border} ${styles.bg}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{label}</p>
        {description && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${description === 'หลัก' ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md' : 'bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 text-slate-800 dark:text-slate-100 font-semibold'}`}>
            {description}
          </span>
        )}
      </div>
      <p className={`mt-3 text-4xl font-bold ${styles.value}`}>{value}</p>
      {footnote && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{footnote}</p>}
    </div>
  )
}

export default KpiCard
