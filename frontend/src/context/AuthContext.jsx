import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as authApi from '../api/auth'
import { clearSession, invalidateSession, loadSession, onSessionInvalidated, saveSession } from '../lib/session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (loadSession() ? 'loading' : 'anonymous'))
  const [notice, setNotice] = useState(null)
  const timer = useRef(null)

  const scheduleExpiry = useCallback(() => {
    clearTimeout(timer.current)
    const s = loadSession()
    if (!s) return
    // setTimeout is capped at ~24.8 days; the maximum token lifetime is 24h, so this is safe.
    timer.current = setTimeout(() => invalidateSession('expired'), Math.max(s.expiresAt - Date.now(), 0) + 250)
  }, [])

  // Restore a session after a page reload (token still valid in sessionStorage).
  useEffect(() => {
    if (!loadSession()) return
    let cancelled = false
    authApi
      .fetchMe()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
        scheduleExpiry()
      })
      .catch((err) => {
        if (cancelled) return
        if (err.kind !== 'auth') {
          // Backend unreachable etc.: keep nothing half-authenticated, but do not blame the user.
          clearSession()
          setNotice('Could not verify your session with the gateway. Please sign in again.')
        }
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [scheduleExpiry])

  // The HTTP layer reports 401s on authenticated calls here.
  useEffect(
    () =>
      onSessionInvalidated((reason) => {
        clearTimeout(timer.current)
        setUser(null)
        setStatus('anonymous')
        if (reason === 'expired') setNotice('Your session has expired. Please sign in again.')
      }),
    [],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const login = useCallback(
    async (username, password) => {
      const token = await authApi.login(username, password)
      saveSession(token.access_token, token.expires_in)
      try {
        const me = await authApi.fetchMe()
        setUser(me)
      } catch (err) {
        clearSession()
        throw err
      }
      setNotice(null)
      setStatus('authenticated')
      scheduleExpiry()
    },
    [scheduleExpiry],
  )

  const logout = useCallback(() => {
    clearTimeout(timer.current)
    clearSession()
    setUser(null)
    setStatus('anonymous')
    setNotice(null)
  }, [])

  const value = useMemo(
    () => ({ user, status, notice, isAdmin: user?.role === 'admin', login, logout, clearNotice: () => setNotice(null) }),
    [user, status, notice, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
