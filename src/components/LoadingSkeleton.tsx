function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-48 rounded bg-slate-100 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <div className="h-6 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-64 rounded-lg bg-slate-100 dark:bg-slate-700" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <div className="h-6 w-40 rounded-lg bg-slate-200 dark:bg-slate-700 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default LoadingSkeleton
