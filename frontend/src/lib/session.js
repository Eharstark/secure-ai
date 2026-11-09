// Session token storage.
//
// Threat model (see README "Frontend security"): the backend issues a short-lived bearer JWT and its CORS
// policy does not allow credentialed (cookie) requests, so the token must live in JavaScript-accessible
// storage. We use sessionStorage (cleared when the tab closes, not shared across tabs, never persisted to
// disk like localStorage) and keep the absolute expiry next to it so the UI can sign out on time.
// A successful XSS could still read it, which is why the app renders no untrusted HTML, ships no inline
// scripts, and the token lifetime is short (JWT_ACCESS_TOKEN_EXPIRE_MINUTES, default 30).
const KEY = 'secureai.session.v1'

function safeStorage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

const listeners = new Set()
let memory = null // fallback when sessionStorage is unavailable

export function saveSession(accessToken, expiresInSeconds) {
  const data = { token: accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }
  memory = data
  try {
    safeStorage()?.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage full / blocked: memory copy still works for this page load */
  }
}

export function loadSession() {
  let data = memory
  if (!data) {
    try {
      const raw = safeStorage()?.getItem(KEY)
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
  }
  if (!data || typeof data.token !== 'string' || typeof data.expiresAt !== 'number') return null
  if (data.expiresAt <= Date.now()) {
    clearSession()
    return null
  }
  memory = data
  return data
}

export function getToken() {
  return loadSession()?.token ?? null
}

export function clearSession() {
  memory = null
  try {
    safeStorage()?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// Called by the HTTP layer when the server rejects the token (401), so the UI can react.
export function onSessionInvalidated(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function invalidateSession(reason) {
  clearSession()
  listeners.forEach((fn) => fn(reason))
}
