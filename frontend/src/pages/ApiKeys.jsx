import { useState } from 'react'
import { AlertTriangle, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import * as keysApi from '../api/apiKeys'
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, CopyButton, EmptyState, Field, PageHeader, Spinner, inputClass } from '../components/ui'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatDateTime, relativeTime } from '../lib/format'
import { keyStatus, summarizeKeys } from '../lib/keys'

const EXPIRY = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'Never expires', value: 0 },
]
const STATUS_TONE = { active: 'green', expired: 'amber', revoked: 'red' }

export default function ApiKeys() {
  const keys = useAsync(keysApi.listApiKeys)
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState(30)
  const [nameError, setNameError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  // The plaintext key is held ONLY in this component state: never stored, never logged, cleared on dismiss/unmount.
  const [newKey, setNewKey] = useState(null)
  const [target, setTarget] = useState(null)
  const [revoking, setRevoking] = useState(false)
  const [actionError, setActionError] = useState(null)

  const list = keys.data ?? []
  const stats = summarizeKeys(list)

  async function onCreate(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setNameError('Give the key a name.')
    if (trimmed.length > 64) return setNameError('Name must be at most 64 characters.')
    setNameError(null)
    setCreateError(null)
    setCreating(true)
    try {
      const created = await keysApi.createApiKey({ name: trimmed, expiresInDays: expiry })
      setNewKey(created)
      setName('')
      await keys.reload()
    } catch (err) {
      setCreateError(err.fieldErrors?.name || err.message)
    } finally {
      setCreating(false)
    }
  }

  async function onRevoke() {
    setRevoking(true)
    setActionError(null)
    try {
      await keysApi.revokeApiKey(target.id)
      if (newKey?.id === target.id) setNewKey(null)
      setTarget(null)
      await keys.reload()
    } catch (err) {
      setTarget(null)
      setActionError(err.kind === 'notfound' ? 'That key no longer exists.' : err.message)
      keys.reload()
    } finally {
      setRevoking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys authenticate programmatic clients with the X-API-Key header. Only a hash is stored on the server, so a key can be shown once, at creation."
        actions={<Button onClick={keys.reload} icon={RefreshCw} loading={keys.loading && !!keys.data}>Refresh</Button>}
      />

      {newKey && (
        <Alert tone="success" title="API key created — copy it now" className="mb-6" onDismiss={() => setNewKey(null)}>
          <p className="mb-3 flex items-start gap-2 text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>This is the only time the full key is shown. It cannot be retrieved later; if you lose it, revoke it and create a new one.</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code data-testid="new-api-key" className="min-w-0 flex-1 select-all break-all rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-xs text-accent-300">{newKey.api_key}</code>
            <CopyButton text={newKey.api_key} label="Copy key" />
          </div>
          <p className="mt-2 text-xs opacity-80">Name: {newKey.name} · Expires: {newKey.expires_at ? formatDateTime(newKey.expires_at) : 'never'}</p>
        </Alert>
      )}
      {actionError && <Alert tone="error" className="mb-6" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:col-span-1">
          <CardHeader title="Create a key" subtitle={`${stats.active} active · max 10 active per account`} />
          <form onSubmit={onCreate} noValidate className="space-y-4 p-5">
            {createError && <Alert tone="error">{createError}</Alert>}
            <Field label="Name" id="key-name" error={nameError} hint="A label to recognise where the key is used.">
              <input id="key-name" className={inputClass(nameError)} maxLength={64} placeholder="e.g. transcription-service" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
            </Field>
            <Field label="Expiration" id="key-expiry">
              <select id="key-expiry" className={inputClass(false)} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
                {EXPIRY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Button type="submit" variant="primary" icon={Plus} loading={creating} className="w-full">Create API key</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Your keys" subtitle="Metadata only — secrets and hashes are never returned by the API" />
          {keys.loading && !keys.data ? (
            <Spinner />
          ) : keys.error && !keys.data ? (
            <div className="p-5"><Alert tone="error" action={<Button onClick={keys.reload}>Retry</Button>}>{keys.error.message}</Alert></div>
          ) : list.length === 0 ? (
            <EmptyState icon={KeyRound} title="No API keys yet">Create your first key with the form to authenticate API clients.</EmptyState>
          ) : (
            <>
              {keys.error && <div className="p-4 pb-0"><Alert tone="error">{keys.error.message}</Alert></div>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-mist-400">
                    <tr className="border-b border-ink-700/70">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-3 py-3 font-medium">Prefix</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                      <th className="px-3 py-3 font-medium">Expires</th>
                      <th className="px-3 py-3 font-medium">Last used</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700/50">
                    {[...list].sort((a, b) => b.id - a.id).map((k) => {
                      const status = keyStatus(k)
                      return (
                        <tr key={k.id} className="hover:bg-ink-800/40">
                          <td className="px-5 py-3 font-medium text-mist-100">{k.name}</td>
                          <td className="px-3 py-3 font-mono text-xs text-mist-300">{k.prefix}…</td>
                          <td className="px-3 py-3 text-mist-300">{formatDate(k.created_at)}</td>
                          <td className="px-3 py-3 text-mist-300">{k.expires_at ? formatDate(k.expires_at) : 'Never'}</td>
                          <td className="px-3 py-3 text-mist-300" title={k.last_used_at ? formatDateTime(k.last_used_at) : undefined}>{k.last_used_at ? relativeTime(k.last_used_at) : 'Never'}</td>
                          <td className="px-3 py-3"><Badge tone={STATUS_TONE[status]} className="capitalize">{status}</Badge></td>
                          <td className="px-5 py-3 text-right">
                            {status === 'active' && (
                              <Button variant="danger" icon={Trash2} onClick={() => setTarget(k)} aria-label={`Revoke ${k.name}`} className="px-2.5 py-1.5 text-xs">Revoke</Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog open={!!target} title="Revoke this API key?" confirmLabel="Revoke key" loading={revoking} onConfirm={onRevoke} onCancel={() => setTarget(null)}>
        Any client using <strong className="text-mist-100">{target?.name}</strong> will immediately lose access. This cannot be undone.
      </ConfirmDialog>
    </>
  )
}
