import type { AnalyticsSummary, Confidence, MetricInsight, TrendDirection } from '../lib/analytics'

function formatNum(value: number): string {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

function TrendIcon({ trend }: { trend: TrendDirection }) {
  if (trend === 'up') return <span aria-hidden>↗️</span>
  if (trend === 'down') return <span aria-hidden>↘️</span>
  return <span aria-hidden>→</span>
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const label = confidence === 'high' ? 'ความเชื่อมั่นสูง' : confidence === 'medium' ? 'ความเชื่อมั่นปานกลาง' : 'ความเชื่อมั่นต่ำ'
  const className =
    confidence === 'high'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : confidence === 'medium'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{label}</span>
}

const SENTIMENT_META: Record<AnalyticsSummary['overallSentiment'], { icon: string; label: string; className: string }> = {
  positive: {
    icon: '🟢',
    label: 'แนวโน้มเป็นบวกโดยรวม',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  negative: {
    icon: '🔴',
    label: 'แนวโน้มเป็นลบโดยรวม',
    className: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
  mixed: {
    icon: '🟡',
    label: 'แนวโน้มผสม ทั้งเพิ่มขึ้นและลดลง',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  flat: {
    icon: '⚪',
    label: 'ไม่มีการเปลี่ยนแปลงที่ชัดเจน',
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
}

function MiniInsightRow({ insight, tone }: { insight: MetricInsight; tone: 'gain' | 'decline' | 'outlier' }) {
  const toneClass =
    tone === 'gain'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'decline'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-amber-600 dark:text-amber-400'
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2 text-sm shadow-sm dark:bg-slate-900/40">
      <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-200">
        <TrendIcon trend={insight.trend} />
        <span className="truncate">{insight.label}</span>
      </span>
      <span className={`flex-shrink-0 font-semibold ${toneClass}`}>
        {insight.change > 0 ? '+' : ''}
        {formatNum(insight.change)}
        {insight.growthPct !== null && (
          <span className="ml-1 text-xs font-normal opacity-80">
            ({insight.growthPct > 0 ? '+' : ''}
            {insight.growthPct.toFixed(1)}%)
          </span>
        )}
      </span>
    </li>
  )
}

export interface AnalyticsCardProps {
  summary: AnalyticsSummary
  /** Period span in days, used only to caption CAGR; pass 0 to hide the CAGR caption. */
  periodDays?: number
}

function AnalyticsCard({ summary, periodDays = 0 }: AnalyticsCardProps) {
  const { insights, topGainers, topDecliners, outliers, overallSentiment, positiveShare, recommendations } = summary
  const sentiment = SENTIMENT_META[overallSentiment]

  if (insights.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/40 p-5 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">การวิเคราะห์เชิงลึก (Analytics)</h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sentiment.className}`}>
          {sentiment.icon} {sentiment.label}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{Math.round(positiveShare * 100)}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">ตัวชี้วัดมีแนวโน้มเพิ่มขึ้น</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{outliers.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">ค่าผิดปกติที่ตรวจพบ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{insights.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">ตัวชี้วัดที่วิเคราะห์ทั้งหมด</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">การเปลี่ยนแปลงที่ดีที่สุด</h4>
          {topGainers.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {topGainers.map((insight) => (
                <MiniInsightRow key={insight.key} insight={insight} tone="gain" />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">ไม่มีตัวชี้วัดที่เพิ่มขึ้น</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-400">การเปลี่ยนแปลงที่ควรเฝ้าระวัง</h4>
          {topDecliners.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {topDecliners.map((insight) => (
                <MiniInsightRow key={insight.key} insight={insight} tone="decline" />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">ไม่มีตัวชี้วัดที่ลดลง</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">รายละเอียดตัวชี้วัดทั้งหมด</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">ตัวชี้วัด</th>
                <th className="px-3 py-2 text-right font-medium">แนวโน้ม</th>
                <th className="px-3 py-2 text-right font-medium">% เปลี่ยนแปลง</th>
                {periodDays > 0 && <th className="px-3 py-2 text-right font-medium">CAGR</th>}
                <th className="px-3 py-2 text-right font-medium">ความผันผวน</th>
                <th className="px-3 py-2 text-right font-medium">ความเชื่อมั่น</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((insight) => (
                <tr
                  key={insight.key}
                  className={`border-b border-slate-100 dark:border-slate-800 ${insight.isOutlier ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                >
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {insight.label}
                    {insight.isOutlier && <span className="ml-1" title="ค่าผิดปกติ">⚠️</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <TrendIcon trend={insight.trend} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">
                    {insight.growthPct === null ? 'N/A' : `${insight.growthPct > 0 ? '+' : ''}${insight.growthPct.toFixed(1)}%`}
                  </td>
                  {periodDays > 0 && (
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                      {insight.cagrPct === null ? 'N/A' : `${insight.cagrPct > 0 ? '+' : ''}${insight.cagrPct.toFixed(1)}%`}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{insight.volatility}</td>
                  <td className="px-3 py-2 text-right">
                    <ConfidenceBadge confidence={insight.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h4 className="mb-2 text-sm font-semibold text-indigo-800 dark:text-indigo-300">คำแนะนำ</h4>
        <ul className="flex flex-col gap-1.5 text-sm text-indigo-900 dark:text-indigo-200">
          {recommendations.map((rec, idx) => (
            <li key={idx} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default AnalyticsCard
