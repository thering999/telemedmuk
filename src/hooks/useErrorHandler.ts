import { useCallback, useState } from 'react'

/**
 * Lets a functional component participate in error-boundary-style recovery
 * for errors it catches itself (e.g. inside event handlers or callbacks).
 * React error boundaries only catch render-phase errors, so async/event
 * errors must be surfaced manually via this hook's `captureError`, which
 * re-throws on the next render so the nearest <ErrorBoundary> can catch it.
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)

  const captureError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err : new Error(String(err)))
  }, [])

  const resetError = useCallback(() => setError(null), [])

  if (error) {
    throw error
  }

  return { captureError, resetError }
}
