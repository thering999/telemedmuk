/**
 * Lightweight, deterministic analytics for the comparison view.
 *
 * Pure math only (no ML): CAGR, trend direction, growth %, acceleration vs.
 * a baseline, a volatility score, and a simple outlier flag. Designed to run
 * over the same { key, label, a, b } metric rows ComparisonView already
 * builds, plus the number of days between period A and period B (used to
 * annualize growth into a CAGR).
 */

export interface AnalyticsInput {
  key: string
  label: string
  a: number
  b: number
}

export type TrendDirection = 'up' | 'down' | 'flat'

export type Confidence = 'high' | 'medium' | 'low'

export interface MetricInsight {
  key: string
  label: string
  a: number
  b: number
  /** Absolute change (b - a). */
  change: number
  /** Percent change relative to a, or null when a is 0 (undefined growth rate). */
  growthPct: number | null
  /** Growth annualized over the period span (Compound Annual Growth Rate), null when undefined/non-finite. */
  cagrPct: number | null
  trend: TrendDirection
  /**
   * Acceleration: how the actual change compares to a naive linear baseline
   * projected from `a` alone (here, the baseline is "no change", so this is
   * simply an alias view of growthPct sign-strength). Expressed as the
   * difference between observed growthPct and 0, scaled for readability.
   * Kept as a distinct field so downstream UI can treat "acceleration" and
   * "growth" as conceptually different even though both derive from the
   * same two-point series.
   */
  accelerationPct: number | null
  /**
   * 0–100 volatility score derived from how large the relative swing is.
   * With only two points we approximate volatility as the magnitude of the
   * relative change clamped to [0, 100] — large swings score higher.
   */
  volatility: number
  /** True when |growthPct| clears the outlier threshold (default 50%). */
  isOutlier: boolean
  confidence: Confidence
}

export interface AnalyticsSummary {
  insights: MetricInsight[]
  /** Top metrics by absolute improvement (positive change), best first. */
  topGainers: MetricInsight[]
  /** Top metrics by absolute decline (negative change), worst first. */
  topDecliners: MetricInsight[]
  /** Metrics flagged as statistical outliers (unusually large swings). */
  outliers: MetricInsight[]
  /** Overall mood across all tracked metrics. */
  overallSentiment: 'positive' | 'negative' | 'mixed' | 'flat'
  /** Share of metrics trending up, 0–1. */
  positiveShare: number
  /** Plain-language Thai recommendations, most important first. */
  recommendations: string[]
}

const OUTLIER_THRESHOLD_PCT = 50
const FLAT_EPSILON_PCT = 1

/** Annualizes a growth ratio over `days` days into a CAGR percentage. */
function calcCagrPct(a: number, b: number, days: number): number | null {
  if (a <= 0 || b < 0 || days <= 0) return null
  const ratio = b / a
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  const years = days / 365
  if (years <= 0) return null
  const cagr = ratio ** (1 / years) - 1
  return Number.isFinite(cagr) ? cagr * 100 : null
}

function calcGrowthPct(a: number, b: number): number | null {
  if (a === 0) return null
  const pct = ((b - a) / a) * 100
  return Number.isFinite(pct) ? pct : null
}

function calcTrend(growthPct: number | null): TrendDirection {
  if (growthPct === null) return 'flat'
  if (growthPct > FLAT_EPSILON_PCT) return 'up'
  if (growthPct < -FLAT_EPSILON_PCT) return 'down'
  return 'flat'
}

function calcVolatility(growthPct: number | null): number {
  if (growthPct === null) return 0
  return Math.min(100, Math.round(Math.abs(growthPct)))
}

function calcConfidence(a: number, b: number): Confidence {
  // Confidence here reflects how much signal the two raw values carry: tiny
  // base values make percentage swings noisy and unreliable.
  const scale = Math.max(Math.abs(a), Math.abs(b))
  if (scale >= 100) return 'high'
  if (scale >= 10) return 'medium'
  return 'low'
}

/**
 * Computes per-metric insights from comparison rows.
 * @param rows metric rows (label + value at period A + value at period B)
 * @param periodDays number of days between period A and period B (for CAGR); pass 0/undefined to skip CAGR
 */
export function computeInsights(rows: AnalyticsInput[], periodDays = 0): MetricInsight[] {
  return rows.map((row) => {
    const change = row.b - row.a
    const growthPct = calcGrowthPct(row.a, row.b)
    const cagrPct = periodDays > 0 ? calcCagrPct(row.a, row.b, periodDays) : null
    const trend = calcTrend(growthPct)
    const volatility = calcVolatility(growthPct)
    const isOutlier = growthPct !== null && Math.abs(growthPct) >= OUTLIER_THRESHOLD_PCT
    return {
      key: row.key,
      label: row.label,
      a: row.a,
      b: row.b,
      change,
      growthPct,
      cagrPct,
      trend,
      accelerationPct: growthPct,
      volatility,
      isOutlier,
      confidence: calcConfidence(row.a, row.b),
    }
  })
}

/** Builds the full analytics summary (insights + rankings + recommendations) for a comparison. */
export function summarizeAnalytics(rows: AnalyticsInput[], periodDays = 0): AnalyticsSummary {
  const insights = computeInsights(rows, periodDays)

  const byChangeDesc = [...insights].sort((x, y) => y.change - x.change)
  const topGainers = byChangeDesc.filter((i) => i.change > 0).slice(0, 3)
  const topDecliners = [...byChangeDesc].reverse().filter((i) => i.change < 0).slice(0, 3)
  const outliers = insights.filter((i) => i.isOutlier)

  const trending = insights.filter((i) => i.trend !== 'flat')
  const upCount = insights.filter((i) => i.trend === 'up').length
  const downCount = insights.filter((i) => i.trend === 'down').length
  const positiveShare = trending.length > 0 ? upCount / trending.length : 0

  let overallSentiment: AnalyticsSummary['overallSentiment']
  if (trending.length === 0) {
    overallSentiment = 'flat'
  } else if (upCount > 0 && downCount === 0) {
    overallSentiment = 'positive'
  } else if (downCount > 0 && upCount === 0) {
    overallSentiment = 'negative'
  } else {
    overallSentiment = 'mixed'
  }

  const recommendations: string[] = []
  for (const decliner of topDecliners) {
    recommendations.push(
      `เน้น "${decliner.label}" — ลดลง ${Math.abs(decliner.change).toLocaleString('th-TH', { maximumFractionDigits: 1 })}` +
        (decliner.growthPct !== null ? ` (${decliner.growthPct.toFixed(1)}%)` : '') +
        ' ควรตรวจสอบสาเหตุ',
    )
  }
  for (const gainer of topGainers.slice(0, 1)) {
    recommendations.push(
      `รักษาแนวโน้มของ "${gainer.label}" — เพิ่มขึ้น ${Math.abs(gainer.change).toLocaleString('th-TH', { maximumFractionDigits: 1 })}` +
        (gainer.growthPct !== null ? ` (+${gainer.growthPct.toFixed(1)}%)` : ''),
    )
  }
  for (const outlier of outliers) {
    if (topGainers.includes(outlier) || topDecliners.includes(outlier)) continue
    recommendations.push(`ตรวจสอบ "${outlier.label}" — มีการเปลี่ยนแปลงผิดปกติ (${outlier.growthPct?.toFixed(1)}%)`)
  }
  if (recommendations.length === 0) {
    recommendations.push('ไม่มีการเปลี่ยนแปลงที่น่ากังวลในช่วงเวลานี้')
  }

  return {
    insights,
    topGainers,
    topDecliners,
    outliers,
    overallSentiment,
    positiveShare,
    recommendations,
  }
}

/** Number of whole days between two ISO (YYYY-MM-DD) dates; 0 if invalid or non-positive. */
export function daysBetween(isoA: string, isoB: string): number {
  const dA = new Date(`${isoA}T00:00:00`)
  const dB = new Date(`${isoB}T00:00:00`)
  if (Number.isNaN(dA.getTime()) || Number.isNaN(dB.getTime())) return 0
  const diff = Math.round((dB.getTime() - dA.getTime()) / 86_400_000)
  return diff > 0 ? diff : 0
}
