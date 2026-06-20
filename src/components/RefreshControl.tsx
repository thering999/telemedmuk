import { REFRESH_INTERVALS, type RefreshIntervalKey, type UseAutoRefreshResult } from '../hooks/useAutoRefresh'
import { formatThaiDateTime } from '../lib/formatThaiDate'

const INTERVAL_LABELS: { key: RefreshIntervalKey; label: string }[] = [
  { key: 'off', label: 'ปิดการรีเฟรช' },
  { key: '5min', label: 'ทุก 5 นาที' },
  { key: '15min', label: 'ทุก 15 นาที' },
  { key: '1hour', label: 'ทุก 1 ชั่วโมง' },
]

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface RefreshControlProps {
  state: UseAutoRefreshResult
}

/**
 * Compact toolbar for controlling dashboard auto-refresh: interval picker,
 * manual refresh button, last-refreshed timestamp (Thai locale), and a
 * pause/resume toggle while a non-"off" interval is selected.
 */
function RefreshControl({ state }: RefreshControlProps) {
  const {
    intervalKey,
    setIntervalKey,
    secondsRemaining,
    lastRefreshedAt,
    isRefreshing,
    lastError,
    refreshNow,
    isPaused,
    pause,
    resume,
  } = state

  const isActive = REFRESH_INTERVALS[intervalKey] > 0

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="refresh-interval" className="font-medium text-slate-600 dark:text-slate-300">
          รีเฟรชอัตโนมัติ
        </label>
        <select
          id="refresh-interval"
          value={intervalKey}
          onChange={(e) => setIntervalKey(e.target.value as RefreshIntervalKey)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {INTERVAL_LABELS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isActive && (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {isPaused ? 'หยุดชั่วคราว' : 'รีเฟรชครั้งถัดไปใน'}
          </span>
          <span className="font-mono text-sm text-slate-800 dark:text-slate-100">
            {isPaused || secondsRemaining === null ? '--:--' : formatCountdown(secondsRemaining)}
          </span>
        </div>
      )}

      {isActive && (
        <button
          type="button"
          onClick={() => (isPaused ? resume() : pause())}
          className="self-end rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-600 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {isPaused ? '▶ เล่นต่อ' : '⏸ หยุดชั่วคราว'}
        </button>
      )}

      <button
        type="button"
        onClick={() => void refreshNow()}
        disabled={isRefreshing}
        className="self-end flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        title="รีเฟรชข้อมูลทันที"
      >
        {isRefreshing ? (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden="true"
          />
        ) : (
          <span aria-hidden="true">⟳</span>
        )}
        {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชตอนนี้'}
      </button>

      <div className="flex flex-col gap-1">
        <span className="font-medium text-slate-600 dark:text-slate-300">รีเฟรชล่าสุด</span>
        <span className="text-slate-500 dark:text-slate-400">
          {lastRefreshedAt ? formatThaiDateTime(lastRefreshedAt) : 'ยังไม่รีเฟรช'}
        </span>
      </div>

      {lastError && (
        <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          รีเฟรชไม่สำเร็จ: {lastError}
        </span>
      )}
    </div>
  )
}

export default RefreshControl
