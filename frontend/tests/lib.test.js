import { describe, expect, it } from 'vitest'
import { ApiError, normalizeError } from '../src/lib/errors'
import { keyStatus, keysCreatedByDay, summarizeKeys } from '../src/lib/keys'
import { parseApiDate } from '../src/lib/format'
import { passwordStrength, validateNewPassword, validateUsername } from '../src/lib/validation'
import { clearSession, getToken, invalidateSession, onSessionInvalidated, saveSession } from '../src/lib/session'

const axiosError = (status, data, headers = {}) => ({ response: { status, data, headers } })

describe('normalizeError', () => {
  it('maps a missing response to a network error that mentions CORS', () => {
    const e = normalizeError({ message: 'Network Error' }, 'http://x/api/v1')
    expect(e).toBeInstanceOf(ApiError)
    expect(e.kind).toBe('network')
    expect(e.message).toMatch(/CORS_ORIGINS/)
  })
  it('maps timeouts', () => expect(normalizeError({ code: 'ECONNABORTED' }).kind).toBe('timeout'))
  it('uses the backend message and kind', () => {
    const e = normalizeError(axiosError(409, { error: 'Conflict', message: 'Username is already registered' }))
    expect(e.kind).toBe('conflict')
    expect(e.message).toBe('Username is already registered')
  })
  it('extracts per-field validation errors without echoing input', () => {
    const e = normalizeError(axiosError(422, { error: 'Unprocessable Entity', message: 'Request validation failed.', details: [{ loc: ['body', 'password'], msg: 'Value error, Password is too repetitive.' }] }))
    expect(e.fieldErrors.password).toBe('Password is too repetitive.')
    expect(e.message).toBe('Password is too repetitive.')
  })
  it('hides server internals on 5xx without a message', () => expect(normalizeError(axiosError(500, 'oops')).message).toMatch(/internal error/))
  it('reads Retry-After on 429', () => {
    const e = normalizeError(axiosError(429, {}, { 'retry-after': '12' }))
    expect(e.kind).toBe('ratelimit')
    expect(e.retryAfter).toBe(12)
  })
})

describe('validation (mirrors backend rules)', () => {
  it('validates usernames', () => {
    expect(validateUsername('ab')).toBeTruthy()
    expect(validateUsername('bad name')).toBeTruthy()
    expect(validateUsername('a'.repeat(33))).toBeTruthy()
    expect(validateUsername('good.user-1_x')).toBeNull()
  })
  it('validates passwords', () => {
    expect(validateNewPassword('short', 'bob')).toMatch(/12/)
    expect(validateNewPassword('xxbobxxxxxxxxxxx', 'bob')).toMatch(/username/)
    expect(validateNewPassword('aaaaaaaaaaaaaaaa', 'bob')).toMatch(/repetitive/)
    expect(validateNewPassword('Zx9-Correct-Horse', 'bob')).toBeNull()
  })
  it('scores strength within 0-4', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('Zx9-Correct-Horse-Battery!')).toBe(4)
  })
})

describe('API key helpers', () => {
  const now = Date.parse('2026-11-09T12:00:00Z')
  const keys = [
    { id: 1, revoked: false, expires_at: null, created_at: '2026-11-09T01:00:00', last_used_at: null },
    { id: 2, revoked: false, expires_at: '2026-11-12T00:00:00', created_at: '2026-11-08T01:00:00', last_used_at: '2026-11-09T00:00:00' },
    { id: 3, revoked: false, expires_at: '2026-11-01T00:00:00', created_at: '2026-10-01T01:00:00', last_used_at: null },
    { id: 4, revoked: true, expires_at: null, created_at: '2026-10-01T01:00:00', last_used_at: null },
  ]
  it('derives status', () => {
    expect(keys.map((k) => keyStatus(k, now))).toEqual(['active', 'active', 'expired', 'revoked'])
  })
  it('summarises', () => {
    expect(summarizeKeys(keys, now)).toEqual({ total: 4, active: 2, revoked: 1, expired: 1, expiringSoon: 1, neverUsed: 1 })
  })
  it('buckets creation by day using only real timestamps', () => {
    const buckets = keysCreatedByDay(keys, 14, now)
    expect(buckets).toHaveLength(14)
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(2) // the two October keys are outside the window
  })
  it('treats naive API timestamps as UTC', () => {
    expect(parseApiDate('2026-11-09T12:00:00').toISOString()).toBe('2026-11-09T12:00:00.000Z')
    expect(parseApiDate('2026-11-09T12:00:00+00:00').toISOString()).toBe('2026-11-09T12:00:00.000Z')
    expect(parseApiDate(null)).toBeNull()
  })
})

describe('session store', () => {
  it('stores, expires and invalidates', () => {
    clearSession()
    expect(getToken()).toBeNull()
    saveSession('tok', 60)
    expect(getToken()).toBe('tok')
    saveSession('old', -1)
    expect(getToken()).toBeNull() // expired tokens are never returned
    saveSession('tok2', 60)
    const seen = []
    const off = onSessionInvalidated((r) => seen.push(r))
    invalidateSession('expired')
    off()
    expect(seen).toEqual(['expired'])
    expect(getToken()).toBeNull()
  })
})
