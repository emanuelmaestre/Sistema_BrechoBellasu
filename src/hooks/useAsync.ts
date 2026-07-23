import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "./useDebounce"

interface UseAsyncOptions {
  /** Debounce delay in ms for search/filter use-cases. Default: 0 (no debounce). */
  debounce?: number
}

interface UseAsyncResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Generic hook that manages loading/error/data state for an async function.
 *
 * @param fn     Async function returning the data. Memoize with useCallback to avoid loops.
 * @param deps   Dependency array — fn is re-called whenever deps change.
 * @param opts   Optional: `debounce` (ms) to wait before firing fn.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  opts: UseAsyncOptions = {}
): UseAsyncResult<T> {
  const { debounce: debounceMs = 0 } = opts
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // Use a stable counter as the debounce target so we can track when deps change
  const depsKey = useDebounce(JSON.stringify([...deps, tick]), debounceMs)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [depsKey, fn])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, refetch }
}
