import type { TypeBreakdownSnapshot } from '../types/hdc'

interface ExecutiveKPIProps {
  allSnapshot: TypeBreakdownSnapshot
}

function ExecutiveKPI({ allSnapshot }: ExecutiveKPIProps) {
  const facilities = allSnapshot.facilities

  // Calculate overall adoption
  const totalType5 = facilities.reduce((sum, f) => {
    const fy69 = f.byYear['69']
    return sum + (fy69?.type5 ?? 0)
  }, 0)

  const totalOP = facilities.reduce((sum, f) => {
    const fy69 = f.byYear['69']
    return sum + (fy69?.op ?? 0)
  }, 0)

  const adoptionRate = totalOP > 0 ? (totalType5 / totalOP) * 100 : 0

  // Top performers
  const topFacilities = [...facilities]
    .map((f) => {
      const fy69 = f.byYear['69']
      if (!fy69 || fy69.op === 0) return null
      return {
        name: f.hospname,
        rate: (fy69.type5 / fy69.op) * 100,
        type5: fy69.type5,
      }
    })
    .filter((x) => x !== null)
    .sort((a, b) => (b?.rate ?? 0) - (a?.rate ?? 0))
    .slice(0, 5)

  // Red flags (rate > 50%)
  const redFlags = facilities.filter((f) => {
    const fy69 = f.byYear['69']
    if (!fy69 || fy69.op === 0) return false
    const rate = (fy69.type5 / fy69.op) * 100
    return rate > 50
  }).length

  return (
    <div className="rounded-2xl border-2 border-cyan-400 bg-gradient-to-r from-cyan-50 to-blue-50 p-6 shadow-lg dark:border-cyan-600 dark:from-slate-800 dark:to-slate-800">
      <h2 className="mb-6 text-2xl font-bold text-cyan-700 dark:text-cyan-400">📊 Executive Summary</h2>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Adoption Rate */}
        <div className="rounded-xl bg-white/80 p-5 dark:bg-slate-800/80">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Overall Adoption Rate</p>
          <p className="mt-3 text-4xl font-bold text-cyan-600 dark:text-cyan-400">
            {adoptionRate.toFixed(1)}%
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
              style={{ width: `${Math.min(adoptionRate, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {totalType5.toLocaleString('th-TH')} of {totalOP.toLocaleString('th-TH')} patients
          </p>
        </div>

        {/* Total Services */}
        <div className="rounded-xl bg-white/80 p-5 dark:bg-slate-800/80">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Facilities</p>
          <p className="mt-3 text-4xl font-bold text-blue-600 dark:text-blue-400">
            {facilities.length}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {facilities.filter(f => {
              const fy69 = f.byYear['69']
              return fy69 && fy69.type5 > 0
            }).length} active
          </p>
        </div>

        {/* Red Flags */}
        <div className="rounded-xl bg-white/80 p-5 dark:bg-slate-800/80">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Data Quality Alert</p>
          <p className="mt-3 text-4xl font-bold text-rose-600 dark:text-rose-400">
            {redFlags}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Facilities with rate &gt; 50% (verify data)
          </p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="mt-6 rounded-xl bg-white/80 p-5 dark:bg-slate-800/80">
        <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">🏆 Top Performers (FY69)</h3>
        <div className="space-y-2">
          {topFacilities.map((facility, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{facility?.name}</span>
              </div>
              <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                {facility?.rate.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ExecutiveKPI
