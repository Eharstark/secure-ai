const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })

// The API returns UTC timestamps; make sure naive strings are parsed as UTC, not local time.
export function parseApiDate(value) {
  if (!value) return null
  const s = String(value)
  const d = new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
export const formatDate = (v) => { const d = parseApiDate(v); return d ? dateFmt.format(d) : '—' }
export const formatDateTime = (v) => { const d = parseApiDate(v); return d ? dateTimeFmt.format(d) : '—' }

export function relativeTime(value, now = Date.now()) {
  const d = parseApiDate(value)
  if (!d) return 'never'
  const diff = Math.round((d.getTime() - now) / 1000)
  const abs = Math.abs(diff)
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]]
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, secs] of units) if (abs >= secs) return rtf.format(Math.round(diff / secs), unit)
  return 'just now'
}
