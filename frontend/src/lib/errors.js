// Turns any Axios/network failure into a small, display-safe object. Server messages come from our own
// backend's consistent error shape: { error, message, details?: [{ loc, msg }] }.
export class ApiError extends Error {
  constructor(message, { status = null, kind = 'unknown', fieldErrors = {}, retryAfter = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind // network | timeout | auth | forbidden | notfound | conflict | validation | ratelimit | server | unknown
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
  }
}

export function normalizeError(err, apiBase = '') {
  if (err instanceof ApiError) return err
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return new ApiError('The request timed out. Please try again.', { kind: 'timeout' })
  }
  const res = err?.response
  if (!res) {
    return new ApiError(
      `Cannot reach the gateway API${apiBase ? ` at ${apiBase}` : ''}. Check that the backend is running and that this site's origin is listed in CORS_ORIGINS.`,
      { kind: 'network' },
    )
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  const status = res.status
  const fieldErrors = {}
  let message = typeof body.message === 'string' ? body.message : ''
  if (status === 422 && Array.isArray(body.details)) {
    for (const d of body.details) {
      const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
      if (field && !fieldErrors[field]) fieldErrors[field] = String(d.msg).replace(/^Value error, /, '')
    }
    message = Object.values(fieldErrors)[0] || 'Some of the submitted values are invalid.'
  }
  const retryAfter = Number(res.headers?.['retry-after']) || null
  const kinds = { 401: 'auth', 403: 'forbidden', 404: 'notfound', 409: 'conflict', 422: 'validation', 429: 'ratelimit' }
  const kind = kinds[status] || (status >= 500 ? 'server' : 'unknown')
  if (!message) {
    message =
      status >= 500
        ? 'The gateway reported an internal error. Please try again later.'
        : status === 429
          ? `Too many requests.${retryAfter ? ` Try again in ${retryAfter}s.` : ''}`
          : `Request failed (HTTP ${status}).`
  }
  return new ApiError(message, { status, kind, fieldErrors, retryAfter })
}
