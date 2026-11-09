import { parseApiDate } from './format.js'

// Derived status of an API key from the fields the backend actually returns.
export function keyStatus(key, now = Date.now()) {
  if (key.revoked) return 'revoked'
  const exp = parseApiDate(key.expires_at)
  if (exp && exp.getTime() <= now) return 'expired'
  return 'active'
}

export function summarizeKeys(keys, now = Date.now()) {
  const out = { total: keys.length, active: 0, revoked: 0, expired: 0, expiringSoon: 0, neverUsed: 0 }
  for (const k of keys) {
    const s = keyStatus(k, now)
    out[s] += 1
    if (s === 'active') {
      const exp = parseApiDate(k.expires_at)
      if (exp && exp.getTime() - now < 7 * 86400000) out.expiringSoon += 1
      if (!k.last_used_at) out.neverUsed += 1
    }
  }
  return out
}

// Keys created per day over the last `days` days (local time buckets). Real data only.
export function keysCreatedByDay(keys, days = 14, now = Date.now()) {
  const buckets = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    d.setHours(0, 0, 0, 0)
    buckets.push({ ts: d.getTime(), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 })
  }
  for (const k of keys) {
    const c = parseApiDate(k.created_at)
    if (!c) continue
    const day = new Date(c); day.setHours(0, 0, 0, 0)
    const b = buckets.find((x) => x.ts === day.getTime())
    if (b) b.count += 1
  }
  return buckets
}
