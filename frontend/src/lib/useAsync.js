import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-loading hook: { data, error, loading, reload }. Ignores results of stale calls.
export function useAsync(fn, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)

  const run = useCallback(() => {
    const id = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null }))
    return fnRef.current().then(
      (data) => { if (id === seq.current) setState({ data, error: null, loading: false }) },
      (error) => { if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false })) },
    )
  }, [])

  useEffect(() => {
    if (enabled) run()
    return () => { seq.current++ }
  }, [enabled, run])

  return { ...state, reload: run }
}
