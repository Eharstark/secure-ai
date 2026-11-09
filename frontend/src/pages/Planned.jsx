import { Bot, Gauge, ScrollText } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'

const PAGES = {
  'rate-limits': {
    title: 'Rate-limit monitoring',
    icon: Gauge,
    needs: 'A rate-limiting layer (Redis-backed) plus persisted rate-limit events and an API to read them.',
    columns: ['Time', 'Client / key prefix', 'Endpoint', 'Result'],
    will: ['Blocked requests and recent HTTP 429 responses', 'Requests per minute', 'Top requesters by user or API-key prefix', 'Per-endpoint request statistics'],
    now: 'No rate limiting exists in the gateway yet, so there is nothing to monitor.',
  },
  'security-events': {
    title: 'Security events',
    icon: ScrollText,
    needs: 'A security_events table written alongside the existing log calls, and a paginated admin endpoint to read it.',
    columns: ['Time', 'Event', 'User', 'Source IP'],
    will: ['Failed and successful logins', 'API key creation and revocation', 'Administrative actions (role / status changes)', 'Unauthorized and forbidden access attempts'],
    now: 'The backend already records these events, but only to its server log (the secureai.security logger). No API exposes them, so the dashboard cannot read them yet.',
  },
  'ai-service': {
    title: 'AI service monitoring',
    icon: Bot,
    needs: 'The Gnani AI provider adapter, usage recording and a status/usage API.',
    columns: ['Time', 'Provider', 'Latency', 'Result'],
    will: ['Provider status', 'Transcription request counts (success / failure)', 'Latency and provider errors', 'Usage statistics'],
    now: 'No AI provider is integrated yet. This page will only show metrics the backend actually records.',
  },
}

export default function Planned({ id }) {
  const p = PAGES[id]
  return (
    <>
      <PageHeader title={p.title} actions={<Badge tone="amber">Planned — not implemented</Badge>} description={p.now} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Data" subtitle="No data source available" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs uppercase tracking-wider text-mist-400">
              <thead><tr className="border-b border-ink-700/70">{p.columns.map((c) => <th key={c} className="px-5 py-3 font-medium">{c}</th>)}</tr></thead>
            </table>
          </div>
          <EmptyState icon={p.icon} title="Nothing to display">
            This view stays empty on purpose. It will be wired to real backend data once the required endpoint exists — it never shows sample values.
          </EmptyState>
        </Card>
        <Card className="h-fit">
          <CardHeader title="What this page will show" />
          <ul className="space-y-2 px-5 py-4 text-sm text-mist-300">
            {p.will.map((w) => <li key={w} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-accent-400" />{w}</li>)}
          </ul>
          <div className="border-t border-ink-700/70 px-5 py-4 text-xs text-mist-400">
            <p className="mb-1 font-semibold uppercase tracking-wider">Backend requirement</p>
            {p.needs}
          </div>
        </Card>
      </div>
    </>
  )
}
