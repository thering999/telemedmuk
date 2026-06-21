import { useMemo, useState } from 'react'
import { BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis, ScatterChart, Scatter } from 'recharts'
import type { TypeBreakdownSnapshot } from '../types/hdc'

interface GeographicHeatmapProps {
  snapshot: TypeBreakdownSnapshot
}

function GeographicHeatmap({ snapshot }: GeographicHeatmapProps) {
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)

  // District aggregation
  const districtData = useMemo(() => {
    const byDistrict = new Map<
      string,
      {
        district: string
        type5: number
        op: number
        facilities: number
        rate: number
      }
    >()

    snapshot.facilities.forEach((f) => {
      const fy69 = f.byYear['69']
      if (!fy69) return

      const key = f.ampName
      const existing = byDistrict.get(key) || {
        district: key,
        type5: 0,
        op: 0,
        facilities: 0,
        rate: 0,
      }

      existing.type5 += fy69.type5 ?? 0
      existing.op += fy69.op ?? 0
      existing.facilities += 1

      byDistrict.set(key, existing)
    })

    return Array.from(byDistrict.values())
      .map((d) => ({
        ...d,
        rate: d.op > 0 ? (d.type5 / d.op) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
  }, [snapshot])

  // Facility details for selected district
  const facilitiesInDistrict = useMemo(() => {
    if (!selectedDistrict) return []
    return snapshot.facilities
      .filter((f) => f.ampName === selectedDistrict)
      .map((f) => {
        const fy69 = f.byYear['69']
        return {
          name: f.hospname,
          type: f.hostypeName,
          rate: fy69 && fy69.op > 0 ? (fy69.type5 / fy69.op) * 100 : 0,
          type5: fy69?.type5 ?? 0,
          op: fy69?.op ?? 0,
        }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [selectedDistrict, snapshot])

  return (
    <div className="space-y-6">
      {/* District Heatmap */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          📍 Geographic Distribution by District
        </h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <BarChart data={districtData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="district"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <YAxis label={{ value: 'Adoption Rate (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Bar
                dataKey="rate"
                fill="#0d9488"
                radius={[4, 4, 0, 0]}
                onClick={(data: any) => setSelectedDistrict(data.district)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">💡 Click a district to see facility details</p>
      </div>

      {/* Facility Details */}
      {selectedDistrict && facilitiesInDistrict.length > 0 && (
        <div className="rounded-2xl border-2 border-cyan-300 dark:border-cyan-700 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              🏥 Facilities in {selectedDistrict}
            </h3>
            <button
              onClick={() => setSelectedDistrict(null)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-2">
            {facilitiesInDistrict.map((facility, idx) => (
              <div key={idx} className="rounded-lg bg-white/80 p-3 dark:bg-slate-700/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{facility.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{facility.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{facility.rate.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {facility.type5}/{facility.op}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
                    style={{ width: `${Math.min(facility.rate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Visualization */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          📈 OP Load vs Adoption Rate
        </h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="op"
                name="OP Count"
                tick={{ fontSize: 11, fill: '#475569' }}
                label={{ value: 'OP Count', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="rate"
                name="Adoption %"
                tick={{ fontSize: 11, fill: '#475569' }}
                label={{ value: 'Adoption %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                name="Districts"
                data={districtData}
                fill="#0d9488"
                onClick={(data: any) => setSelectedDistrict(data.district)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default GeographicHeatmap
