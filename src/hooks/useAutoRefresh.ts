import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'telemedmuk-auto-refresh-interval'

/** Interval choices in ms. `0` means "off". */
export const REFRESH_INTERVALS = {
  off: 0,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1hour': 60 * 60 * 1000,
} as const

export type RefreshIntervalKey = keyof typeof REFRESH_INTERVALS

function isRefreshIntervalKey(value: string | null): value is RefreshIntervalKey {
  return value !== null && value in REFRESH_INTERVALS
}

function getStoredInterval(): RefreshIntervalKey {
  if (typeof window === 'undefined') return '5min'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isRefreshIntervalKey(stored) ? stored : '5min'
}

export interface UseAutoRefreshOptions {
  /** Called to actually fetch fresh data. May reject — failures are surfaced via `lastError` and don't stop the timer. */
  onRefresh: () => Promise<void>
}

export interface UseAutoRefreshResult {
  /** Currently-selected interval key ('off' pauses refreshing). */
  intervalKey: RefreshIntervalKey
  /** Persists the new interval choice to localStorage and (re)starts the timer. */
  setIntervalKey: (key: RefreshIntervalKey) => void
  /** Seconds remaining until the next auto-refresh; null when paused/off. */
  secondsRemaining: number | null
  /** Timestamp of the last successful refresh (or null if none yet this session). */
  lastRefreshedAt: Date | null
  /** True while a refresh (auto or manual) is in flight. */
  isRefreshing: boolean
  /** Error message from the most recent failed refresh, if any. */
  lastError: string | null
  /** Triggers an immediate refresh, resetting the countdown afterwards. */
  refreshNow: () => Promise<void>
  /** Whether auto-refresh is currently paused (distinct from being set to 'off'). */
  isPaused: boolean
  /** Pauses the countdown without changing the selected interval. */
  pause: () => void
  /** Resumes the countdown using the currently-selected interval. */
  resume: () => void
}

/**
 * Drives periodic re-fetching of dashboard data on a user-selectable interval,
 * persisted to localStorage. Designed to wrap a lightweight "is there new
 * data" fetch (e.g. index.json) rather than re-fetching heavy snapshots
 * directly, so it doesn't spam the server.
 *
 * Refreshing is skipped while the browser tab is hidden or the browser is
 * offline, and resumes (without double-firing) when the tab becomes visible
 * or connectivity returns.
 */
export function useAutoRefresh({ onRefresh }: UseAutoRefreshOptions): UseAutoRefreshResult {
  const [intervalKey, setIntervalKeyState] = useState<RefreshIntervalKey>(getStoredInterval)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  // Latest onRefresh without forcing the timer effect to re-subscribe.
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const isRefreshingRef = useRef(false)
  const deadlineRef = useRef<number | null>(null)

  const runRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    isRefreshingRef.current = true
    setIsRefreshing(true)
    try {
      await onRefreshRef.current()
      setLastRefreshedAt(new Date())
      setLastError(null)
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : 'ไม่สามารถรีเฟรชข้อมูลได้')
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [])

  const refreshNow = useCallback(async () => {
    deadlineRef.current = Date.now() + REFRESH_INTERVALS[intervalKey]
    await runRefresh()
  }, [runRefresh, intervalKey])

  const setIntervalKey = useCallback((key: RefreshIntervalKey) => {
    setIntervalKeyState(key)
    window.localStorage.setItem(STORAGE_KEY, key)
    deadlineRef.current = key === 'off' ? null : Date.now() + REFRESH_INTERVALS[key]
  }, [])

  const pause = useCallback(() => setIsPaused(true), [])
  const resume = useCallback(() => {
    deadlineRef.current = Date.now() + REFRESH_INTERVALS[intervalKey]
    setIsPaused(false)
  }, [intervalKey])

  // Tick every second: updates the countdown and fires a refresh once the
  // deadline passes. A single 1s interval (rather than one timeout per
  // refresh cycle) keeps the displayed countdown smooth and self-correcting.
  useEffect(() => {
    const ms = REFRESH_INTERVALS[intervalKey]
    if (ms === 0 || isPaused) {
      deadlineRef.current = null
      // Deferred to a microtask so this isn't a synchronous setState call
      // in the effect body (mirrors the pattern used elsewhere in this app,
      // e.g. ComparisonView's useSnapshotByDate loading transition).
      void Promise.resolve().then(() => setSecondsRemaining(null))
      return
    }
    if (deadlineRef.current === null) {
      deadlineRef.current = Date.now() + ms
    }

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      const deadline = deadlineRef.current
      if (deadline === null) return
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        deadlineRef.current = Date.now() + ms
        setSecondsRemaining(ms / 1000)
        void runRefresh()
        return
      }
      setSecondsRemaining(Math.ceil(remainingMs / 1000))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [intervalKey, isPaused, runRefresh])

  // When the tab regains visibility (or the browser regains connectivity)
  // after being away past the deadline, refresh immediately instead of
  // waiting for the next tick — but don't double-fire if still on time.
  useEffect(() => {
    const maybeCatchUp = () => {
      if (REFRESH_INTERVALS[intervalKey] === 0 || isPaused) return
      if (document.visibilityState !== 'visible') return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      const deadline = deadlineRef.current
      if (deadline !== null && Date.now() >= deadline) {
        deadlineRef.current = Date.now() + REFRESH_INTERVALS[intervalKey]
        void runRefresh()
      }
    }
    document.addEventListener('visibilitychange', maybeCatchUp)
    window.addEventListener('online', maybeCatchUp)
    return () => {
      document.removeEventListener('visibilitychange', maybeCatchUp)
      window.removeEventListener('online', maybeCatchUp)
    }
  }, [intervalKey, isPaused, runRefresh])

  return {
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
  }
}
