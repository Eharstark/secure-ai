import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search, UserX, Users as UsersIcon } from 'lucide-react'
import * as adminApi from '../api/admin'
import { useAuth } from '../context/AuthContext'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Spinner, inputClass } from '../components/ui'
import { useAsync } from '../lib/useAsync'
import { formatDate, relativeTime } from '../lib/format'

const PAGE_SIZE = 15

export default function Users() {
  const { user: me } = useAuth()
  const all = useAsync(adminApi.listAllUsers)
  const [overrides, setOverrides] = useState({}) // id -> updated user returned by the API
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(null) // { user, changes, title, body }

  const users = useMemo(() => (all.data?.users ?? []).map((u) => overrides[u.id] ?? u), [all.data, overrides])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => (roleFilter === 'all' || u.role === roleFilter) && (!q || u.username.toLowerCase().includes(q)))
  }, [users, query, roleFilter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  async function apply() {
    const { user, changes } = pending
    setBusyId(user.id)
    setError(null)
    try {
      const updated = await adminApi.updateUser(user.id, changes)
      setOverrides((o) => ({ ...o, [updated.id]: updated }))
    } catch (err) {
      setError(err.kind === 'forbidden' ? `Not allowed: ${err.message}` : err.message)
    } finally {
      setBusyId(null)
      setPending(null)
    }
  }

  const askRole = (u, role) =>
    setPending({
      user: u,
      changes: { role },
      title: `Change role to ${role}?`,
      body: role === 'admin' ? `${u.username} will be able to manage all users and keys.` : `${u.username} will lose administrator access.`,
    })
  const askActive = (u) =>
    setPending({
      user: u,
      changes: { is_active: !u.is_active },
      title: u.is_active ? 'Deactivate this account?' : 'Reactivate this account?',
      body: u.is_active ? `${u.username} will be unable to sign in and their API keys will stop working.` : `${u.username} will be able to sign in again.`,
    })

  return (
    <>
      <PageHeader
        title="User management"
        description="Administrator-only. Role and status changes take effect on the user's very next request."
        actions={<Button onClick={() => { setOverrides({}); all.reload() }} icon={RefreshCw} loading={all.loading && !!all.data}>Refresh</Button>}
      />
      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Alert>}
      {all.data?.truncated && <Alert tone="warning" className="mb-4">Showing the first 5,000 users only.</Alert>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-700/70 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-400" aria-hidden />
            <input aria-label="Search users" placeholder="Search by username" className={inputClass(false) + ' pl-9'} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} />
          </div>
          <select aria-label="Filter by role" className={inputClass(false) + ' sm:w-40'} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}>
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {all.loading && !all.data ? (
          <Spinner />
        ) : all.error && !all.data ? (
          <div className="p-5"><Alert tone="error" action={<Button onClick={all.reload}>Retry</Button>}>{all.error.message}</Alert></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={UsersIcon} title={users.length ? 'No users match your filters' : 'No users found'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-mist-400">
                <tr className="border-b border-ink-700/70">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/50">
                {rows.map((u) => {
                  const self = u.id === me.id
                  const busy = busyId === u.id
                  return (
                    <tr key={u.id} className="hover:bg-ink-800/40">
                      <td className="px-5 py-3">
                        <span className="font-medium text-mist-100">{u.username}</span>
                        {self && <Badge tone="cyan" className="ml-2">You</Badge>}
                        <span className="ml-2 font-mono text-xs text-mist-400">#{u.id}</span>
                      </td>
                      <td className="px-3 py-3"><Badge tone={u.role === 'admin' ? 'cyan' : 'slate'} className="capitalize">{u.role}</Badge></td>
                      <td className="px-3 py-3"><Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-3 py-3 text-mist-300" title={relativeTime(u.created_at)}>{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {self ? (
                            <span className="text-xs text-mist-400">Your own account can't be changed</span>
                          ) : (
                            <>
                              <select aria-label={`Role for ${u.username}`} disabled={busy} value={u.role} onChange={(e) => e.target.value !== u.role && askRole(u, e.target.value)} className={inputClass(false) + ' w-28 py-1.5'}>
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                              <Button variant={u.is_active ? 'danger' : 'secondary'} icon={u.is_active ? UserX : undefined} loading={busy} onClick={() => askActive(u)} className="px-2.5 py-1.5 text-xs">
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink-700/70 px-5 py-3 text-xs text-mist-400">
            <span>{filtered.length} user{filtered.length === 1 ? '' : 's'}{filtered.length !== users.length ? ` (of ${users.length})` : ''}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" icon={ChevronLeft} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" className="px-2 py-1" />
              <span>Page {current + 1} of {pages}</span>
              <Button variant="ghost" icon={ChevronRight} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" className="px-2 py-1" />
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!pending} title={pending?.title} tone={pending?.changes.is_active === false || pending?.changes.role === 'admin' ? 'danger' : 'primary'} confirmLabel="Apply change" loading={busyId !== null} onConfirm={apply} onCancel={() => setPending(null)}>
        {pending?.body}
      </ConfirmDialog>
    </>
  )
}
