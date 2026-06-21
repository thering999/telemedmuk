interface EmptyStateProps {
  icon?: string
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
}

function EmptyState({ icon = '📭', title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-900">
      <p className="text-5xl">{icon}</p>
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {message && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
