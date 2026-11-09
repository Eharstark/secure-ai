import { Link } from 'react-router-dom'
import { Activity, CalendarClock, CheckCircle2, Gauge, KeyRound, ShieldAlert, Timer, UserCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as adminApi from '../api/admin'
import * as keysApi from '../api/apiKeys'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, StatCard } from '../components/ui'
import { CHART_COLORS, DailyBars, DonutChart } from '../components/charts'
import { useAsync } from '../lib/useAsync'
import { formatDateTime } from '../lib/format'
import { keysCreatedByDay, summarizeKeys } from '../lib/keys'

function Section({ state, children, empty }) {
  if (state.loading && !state.data) return <Spinner />
  if (state.error) return <div className="p-5"><Alert tone="error" action={<Button onClick={state.reload}>Retry</Button>}>{state.error.message}</Alert></div>
  return children(state.data) ?? empty
}

export default function Overview() {
  const { user, isAdmin } = useAuth()
  const keys = useAsync(keysApi.listApiKeys)
  const users = useAsync(adminApi.listAllUsers, isAdmin)

  const keyStats = keys.data ? summarizeKeys(keys.data) : null
  const userStats = users.data
    ? {
        total: users.data.users.length,
        active: users.data.users.filter((u) => u.is_active).length,
        admins: users.data.users.filter((u) => u.role === 'admin').length,
      }
    : null

  return (
    <>
      <PageHeader title={`Welcome back, ${user.username}`} description="Live view of your account and API keys. Figures come directly from the gateway API; nothing here is simulated." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active API keys" value={keyStats ? keyStats.active : '—'} icon={KeyRound} hint={keyStats ? `${keyStats.total} total` : 'Loading…'} />
        <StatCard label="Expiring ≤ 7 days" value={keyStats ? keyStats.expiringSoon : '—'} icon={CalendarClock} tone="amber" hint="Active keys with an expiry date" />
        {isAdmin ? (
          <>
            <StatCard label="Registered users" value={userStats ? userStats.total : '—'} icon={Users} hint={userStats ? `${userStats.admins} administrator${userStats.admins === 1 ? '' : 's'}` : users.error ? 'Unavailable' : 'Loading…'} />
            <StatCard label="Active users" value={userStats ? userStats.active : '—'} icon={UserCheck} tone="green" hint={userStats ? `${userStats.total - userStats.active} deactivated` : undefined} />
          </>
        ) : (
          <>
            <StatCard label="Never-used keys" value={keyStats ? keyStats.neverUsed : '—'} icon={Activity} tone="slate" hint="Active keys with no recorded use" />
            <StatCard label="Revoked / expired" value={keyStats ? keyStats.revoked + keyStats.expired : '—'} icon={ShieldAlert} tone="red" hint={keyStats ? `${keyStats.revoked} revoked · ${keyStats.expired} expired` : undefined} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Your account" subtitle="From GET /users/me" />
          <dl className="divide-y divide-ink-700/60 text-sm">
            {[
              ['Username', user.username],
              ['Role', <Badge key="r" tone={user.role === 'admin' ? 'cyan' : 'slate'}>{user.role}</Badge>],
              ['Status', <Badge key="s" tone={user.is_active ? 'green' : 'red'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>],
              ['User ID', <span key="i" className="font-mono">{user.id}</span>],
              ['Member since', formatDateTime(user.created_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-mist-400">{k}</dt>
                <dd className="text-right text-mist-100">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="API key status" subtitle="Your keys by current state" />
          <div className="p-4">
            <Section state={keys}>
              {(list) =>
                list.length === 0 ? (
                  <EmptyState icon={KeyRound} title="No API keys yet" action={<Link to="/api-keys"><Button variant="primary">Create a key</Button></Link>} />
                ) : (
                  <DonutChart data={[
                    { name: 'Active', value: keyStats.active, color: CHART_COLORS.green },
                    { name: 'Expired', value: keyStats.expired, color: CHART_COLORS.amber },
                    { name: 'Revoked', value: keyStats.revoked, color: CHART_COLORS.rose },
                  ]} />
                )
              }
            </Section>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Keys created" subtitle="Last 14 days" />
          <div className="p-4">
            <Section state={keys}>
              {(list) => (list.length === 0 ? <EmptyState title="Nothing to chart yet">Create an API key and it will appear here.</EmptyState> : <DailyBars data={keysCreatedByDay(list)} />)}
            </Section>
          </div>
        </Card>
      </div>

      {isAdmin && (
        <Card className="mt-6">
          <CardHeader title="User base" subtitle="Admin view from GET /admin/users" action={<Link to="/admin/users"><Button>Manage users</Button></Link>} />
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Section state={users}>
              {(d) => (
                <>
                  <DonutChart height={200} data={[
                    { name: 'Users', value: d.users.filter((u) => u.role === 'user').length, color: CHART_COLORS.blue },
                    { name: 'Admins', value: d.users.filter((u) => u.role === 'admin').length, color: CHART_COLORS.cyan },
                  ]} />
                  <DonutChart height={200} data={[
                    { name: 'Active', value: d.users.filter((u) => u.is_active).length, color: CHART_COLORS.green },
                    { name: 'Inactive', value: d.users.filter((u) => !u.is_active).length, color: CHART_COLORS.slate },
                  ]} />
                  {d.truncated && <Alert tone="warning" className="md:col-span-2">Only the first 5,000 users were counted.</Alert>}
                </>
              )}
            </Section>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Gateway traffic and security telemetry" action={<Badge tone="amber">Not implemented</Badge>} />
        <EmptyState icon={Gauge} title="No traffic metrics available">
          Request counts, success/failure rates, rate-limit events, latency and security-event history are not recorded by the backend yet,
          so nothing is shown instead of invented numbers. Planned for the next backend milestone (see Monitoring in the sidebar).
        </EmptyState>
        <div className="flex flex-wrap gap-2 border-t border-ink-700/70 px-5 py-3 text-xs text-mist-400">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-400" /> Working: account, API keys{isAdmin ? ', user counts' : ''}, API health</span>
          <span className="inline-flex items-center gap-1"><Timer className="size-3.5 text-amber-400" /> Placeholder: traffic, rate limits, security events, AI usage</span>
        </div>
      </Card>
    </>
  )
}
