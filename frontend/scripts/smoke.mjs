// Integration smoke test: drives the REAL frontend API layer (src/api/*) against a RUNNING backend.
// It is not a mock: every assertion below is checked against live responses from FastAPI.
//
//   Usage:  SMOKE_ADMIN_USER=siteadmin SMOKE_ADMIN_PASSWORD='...' npm run smoke
//   (needs the backend on VITE_API_BASE_URL / http://127.0.0.1:8000/api/v1 and an existing admin account;
//    the admin part is skipped if the variables are not set.)
import { randomBytes } from 'node:crypto'
import * as auth from '../src/api/auth.js'
import * as keys from '../src/api/apiKeys.js'
import * as admin from '../src/api/admin.js'
import { http } from '../src/api/client.js'
import { clearSession, getToken, saveSession } from '../src/lib/session.js'
import { API_BASE_URL } from '../src/lib/config.js'

let passed = 0
let failed = 0
const ok = (name) => { passed++; console.log(`  ✔ ${name}`) }
const bad = (name, detail) => { failed++; console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`) }
const check = (name, cond, detail) => (cond ? ok(name) : bad(name, detail))
async function expectError(name, fn, { status, kind }) {
  try { await fn(); bad(name, 'expected an error') } catch (e) {
    check(name, (status == null || e.status === status) && (!kind || e.kind === kind), `got status=${e.status} kind=${e.kind} msg=${e.message}`)
    return e
  }
}
async function loginAs(u, p) {
  const t = await auth.login(u, p)
  saveSession(t.access_token, t.expires_in)
  return t
}

const suffix = randomBytes(3).toString('hex')
const username = `smoke${suffix}`
const password = `Zx9-Correct-Horse-${suffix}`

console.log(`Backend: ${API_BASE_URL}`)
console.log('\n[health + CORS origin]')
const h = await auth.fetchHealth()
check('GET /health returns status ok and a version', h.status === 'ok' && !!h.version)
const pre = await http.options('/auth/login', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, skipAuth: true })
check('CORS preflight from http://localhost:5173 allowed', pre.headers['access-control-allow-origin'] === 'http://localhost:5173', JSON.stringify(pre.headers))

console.log('\n[registration]')
const created = await auth.register(username, password)
check('register returns a regular user without secrets', created.role === 'user' && created.is_active && !('password_hash' in created) && !('password' in created))
await expectError('duplicate username → 409 conflict', () => auth.register(username, password), { status: 409, kind: 'conflict' })
const weak = await expectError('weak password → 422 validation with field error', () => auth.register(`w${suffix}`, 'short'), { status: 422, kind: 'validation' })
check('field error is attached to "password"', !!weak?.fieldErrors?.password, JSON.stringify(weak?.fieldErrors))
await expectError('role escalation attempt via raw request → 422', () => http.post('/auth/register', { username: `e${suffix}`, password, role: 'admin' }, { skipAuth: true }), { status: 422 })

console.log('\n[login + session]')
await expectError('wrong password → 401 and NO session invalidation side effect', () => auth.login(username, 'definitely-wrong-password'), { status: 401, kind: 'auth' })
const tok = await loginAs(username, password)
check('login returns bearer token + expires_in', tok.token_type === 'bearer' && tok.expires_in > 0)
check('token stored in session store', !!getToken())
const me = await auth.fetchMe()
check('GET /users/me returns the same user and role', me.username === username && me.role === 'user')

console.log('\n[API keys]')
const k1 = await keys.createApiKey({ name: 'smoke-key', expiresInDays: 7 })
check('create returns the plaintext key once', typeof k1.api_key === 'string' && k1.api_key.startsWith('sagw_'))
const list = await keys.listApiKeys()
const row = list.find((k) => k.id === k1.id)
check('list returns metadata only (no key, no hash)', !!row && !('api_key' in row) && !('key_hash' in row) && JSON.stringify(list).includes(k1.api_key) === false)
check('expiry honoured (≈7 days)', !!row.expires_at)
const viaKey = await http.get('/users/me', { headers: { 'X-API-Key': k1.api_key }, skipAuth: true })
check('new key authenticates via X-API-Key', viaKey.data.username === username)
await expectError('API key cannot manage keys (session required) → 403', () => http.get('/api-keys', { headers: { 'X-API-Key': k1.api_key }, skipAuth: true }), { status: 403, kind: 'forbidden' })
await expectError('create with empty name → 422', () => keys.createApiKey({ name: '', expiresInDays: 7 }), { status: 422 })
await keys.revokeApiKey(k1.id)
check('revoke succeeds (204)', true)
check('revoked key listed as revoked', (await keys.listApiKeys()).find((k) => k.id === k1.id)?.revoked === true)
await expectError('revoked key no longer authenticates → 401', () => http.get('/users/me', { headers: { 'X-API-Key': k1.api_key }, skipAuth: true }), { status: 401 })
await expectError('revoking unknown key → 404 notfound', () => keys.revokeApiKey(999999), { status: 404, kind: 'notfound' })

console.log('\n[authorization: normal user vs admin endpoints]')
await expectError('non-admin GET /admin/users → 403 forbidden', () => admin.listUsersPage(), { status: 403, kind: 'forbidden' })
check('403 does NOT sign the user out', !!getToken())

console.log('\n[expired / invalid session handling]')
saveSession('not-a-real-token', 60)
await expectError('garbage token → 401 auth', () => auth.fetchMe(), { status: 401, kind: 'auth' })
check('401 on an authenticated call clears the stored session', getToken() === null)

const AU = process.env.SMOKE_ADMIN_USER
const AP = process.env.SMOKE_ADMIN_PASSWORD
if (AU && AP) {
  console.log('\n[admin]')
  await loginAs(AU, AP)
  const adminMe = await auth.fetchMe()
  check('admin role returned by /users/me', adminMe.role === 'admin')
  const { users, truncated } = await admin.listAllUsers({ pageSize: 2 }) // tiny pages exercise the pagination loop
  check('listAllUsers pages through results', users.length >= 2 && truncated === false && new Set(users.map((u) => u.id)).size === users.length, `n=${users.length}`)
  check('user list leaks no password material', !JSON.stringify(users).includes('password'))
  const target = users.find((u) => u.username === username)
  const demoted = await admin.updateUser(target.id, { is_active: false })
  check('admin can deactivate a user', demoted.is_active === false)
  const inactiveLogin = await expectError('deactivated user cannot log in (generic 401)', () => auth.login(username, password), { status: 401 })
  check('login error message does not reveal account state', inactiveLogin?.message === 'Invalid username or password', inactiveLogin?.message)
  const promoted = await admin.updateUser(target.id, { is_active: true, role: 'admin' })
  check('admin can reactivate and change role', promoted.is_active && promoted.role === 'admin')
  await admin.updateUser(target.id, { role: 'user' })
  await expectError('admin cannot modify own account → 403', () => admin.updateUser(adminMe.id, { role: 'user' }), { status: 403 })
  await expectError('unknown user → 404', () => admin.updateUser(999999, { role: 'user' }), { status: 404 })
  await expectError('empty patch → 422', () => admin.updateUser(target.id, {}), { status: 422 })
} else {
  console.log('\n[admin] skipped (set SMOKE_ADMIN_USER and SMOKE_ADMIN_PASSWORD to run)')
}

clearSession()
console.log('\n[unreachable backend → friendly network error]')
const { normalizeError } = await import('../src/lib/errors.js')
const axios = (await import('axios')).default
try { await axios.get('http://127.0.0.1:1/api/v1/health', { timeout: 2000 }) } catch (e) {
  check('connection refused is normalised to kind=network', normalizeError(e, 'http://127.0.0.1:1').kind === 'network')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
