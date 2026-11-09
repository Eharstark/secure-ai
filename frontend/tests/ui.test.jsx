// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../src/lib/errors'

vi.mock('../src/api/auth.js', () => ({ login: vi.fn(), register: vi.fn(), fetchMe: vi.fn(), fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', version: '0.2.0' }) }))
vi.mock('../src/api/apiKeys.js', () => ({ listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn() }))
vi.mock('../src/api/admin.js', () => ({ listAllUsers: vi.fn(), listUsersPage: vi.fn(), updateUser: vi.fn() }))
// Recharts needs real layout; jsdom has none, so charts are stubbed (chart data wiring is covered by lib tests).
vi.mock('../src/components/charts.jsx', () => ({ DonutChart: () => <div data-testid="donut" />, DailyBars: () => <div data-testid="bars" />, CHART_COLORS: {} }))

import * as authApi from '../src/api/auth.js'
import * as keysApi from '../src/api/apiKeys.js'
import * as adminApi from '../src/api/admin.js'
import { AuthProvider } from '../src/context/AuthContext'
import { clearSession, saveSession } from '../src/lib/session.js'
import App from '../src/App'

const alice = { id: 2, username: 'alice', role: 'user', is_active: true, created_at: '2026-11-01T10:00:00' }
const root = { id: 1, username: 'siteadmin', role: 'admin', is_active: true, created_at: '2026-10-01T10:00:00' }

function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}
function signedInAs(user) {
  saveSession('tok', 600)
  authApi.fetchMe.mockResolvedValue(user)
}

beforeEach(() => { vi.clearAllMocks(); clearSession(); authApi.fetchHealth.mockResolvedValue({ status: 'ok', version: '0.2.0' }) })
afterEach(cleanup)

describe('routing and guards', () => {
  it('redirects anonymous visitors to the login page', async () => {
    mount('/api-keys')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
  it('hides admin navigation and blocks /admin/users for normal users', async () => {
    signedInAs(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    mount('/admin/users')
    expect(await screen.findByText('Administrator access required')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Users$/ })).not.toBeInTheDocument()
    expect(adminApi.listAllUsers).not.toHaveBeenCalled()
  })
  it('shows the admin link to administrators', async () => {
    signedInAs(root)
    keysApi.listApiKeys.mockResolvedValue([])
    adminApi.listAllUsers.mockResolvedValue({ users: [root, alice], truncated: false })
    mount('/')
    expect(await screen.findByRole('link', { name: /^Users$/ })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('validates empty fields without calling the API', async () => {
    mount('/login')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your username.')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })
  it('shows the server error and clears the password on failure', async () => {
    authApi.login.mockRejectedValue(new ApiError('Invalid username or password', { status: 401, kind: 'auth' }))
    mount('/login')
    await userEvent.type(screen.getByLabelText('Username'), 'alice')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password-123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
  it('signs in and lands on the dashboard showing user and role', async () => {
    authApi.login.mockResolvedValue({ access_token: 'jwt', token_type: 'bearer', expires_in: 1800 })
    authApi.fetchMe.mockResolvedValue(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    mount('/login')
    await userEvent.type(screen.getByLabelText('Username'), 'alice')
    await userEvent.type(screen.getByLabelText('Password'), 'Zx9-Correct-Horse')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Welcome back, alice')).toBeInTheDocument()
    expect(screen.getAllByText('user').length).toBeGreaterThan(0)
  })
})

describe('registration', () => {
  it('rejects mismatched passwords and short passwords client-side', async () => {
    mount('/register')
    await userEvent.type(screen.getByLabelText('Username'), 'newuser')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })
  it('sends only username and password (never a role) and moves to login', async () => {
    authApi.register.mockResolvedValue(alice)
    mount('/register')
    await userEvent.type(screen.getByLabelText('Username'), 'newuser')
    await userEvent.type(screen.getByLabelText('Password'), 'Zx9-Correct-Horse')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Zx9-Correct-Horse')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(authApi.register).toHaveBeenCalledWith('newuser', 'Zx9-Correct-Horse'))
    expect(await screen.findByText('Account created. Sign in to continue.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })
})

describe('API keys page', () => {
  it('shows the new key once with a warning, then never again after dismissal', async () => {
    signedInAs(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    keysApi.createApiKey.mockResolvedValue({ id: 5, name: 'svc', prefix: 'abcd1234', created_at: '2026-11-09T10:00:00', expires_at: null, last_used_at: null, revoked: false, api_key: 'sagw_abcd1234_SECRETVALUE' })
    mount('/api-keys')
    await userEvent.type(await screen.findByLabelText('Name'), 'svc')
    await userEvent.click(screen.getByRole('button', { name: 'Create API key' }))
    expect(await screen.findByTestId('new-api-key')).toHaveTextContent('sagw_abcd1234_SECRETVALUE')
    expect(screen.getByText(/only time the full key is shown/i)).toBeInTheDocument()
    expect(keysApi.createApiKey).toHaveBeenCalledWith({ name: 'svc', expiresInDays: 30 })
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/SECRETVALUE/)).not.toBeInTheDocument()
  })
  it('lists keys with status badges and no secret material, and revokes after confirmation', async () => {
    signedInAs(alice)
    const key = { id: 7, name: 'ci-key', prefix: 'deadbeef', created_at: '2026-11-01T10:00:00', expires_at: null, last_used_at: null, revoked: false }
    keysApi.listApiKeys.mockResolvedValueOnce([key]).mockResolvedValue([{ ...key, revoked: true }])
    keysApi.revokeApiKey.mockResolvedValue(undefined)
    mount('/api-keys')
    expect(await screen.findByText('ci-key')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('active')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revoke ci-key' }))
    const dialog = await screen.findByRole('dialog')
    expect(keysApi.revokeApiKey).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke key' }))
    await waitFor(() => expect(keysApi.revokeApiKey).toHaveBeenCalledWith(7))
    expect(await within(screen.getByRole('table')).findByText('revoked')).toBeInTheDocument()
  })
  it('surfaces API errors (e.g. key limit) from the server', async () => {
    signedInAs(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    keysApi.createApiKey.mockRejectedValue(new ApiError('Maximum of 10 active API keys reached', { status: 409, kind: 'conflict' }))
    mount('/api-keys')
    await userEvent.type(await screen.findByLabelText('Name'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Create API key' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Maximum of 10 active API keys reached')
  })
})

describe('admin user management', () => {
  it('lists, filters, disables self-edit and applies a role change after confirmation', async () => {
    signedInAs(root)
    adminApi.listAllUsers.mockResolvedValue({ users: [root, alice], truncated: false })
    adminApi.updateUser.mockResolvedValue({ ...alice, role: 'admin' })
    mount('/admin/users')
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText("Your own account can't be changed")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Search users'), 'ali')
    expect(within(screen.getByRole('table')).queryByText('siteadmin')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Role for alice'), 'admin')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply change' }))
    await waitFor(() => expect(adminApi.updateUser).toHaveBeenCalledWith(2, { role: 'admin' }))
  })
  it('shows a retryable error state when the API fails', async () => {
    signedInAs(root)
    adminApi.listAllUsers.mockRejectedValue(new ApiError('Cannot reach the gateway API', { kind: 'network' }))
    mount('/admin/users')
    expect(await screen.findByText(/Cannot reach the gateway API/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('honesty of monitoring pages', () => {
  it.each(['rate-limits', 'security-events', 'ai-service'])('%s is an explicit placeholder without data rows', async (page) => {
    signedInAs(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    mount(`/monitoring/${page}`)
    expect(await screen.findByText('Planned — not implemented')).toBeInTheDocument()
    expect(screen.getByText('Nothing to display')).toBeInTheDocument()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0)
  })
  it('overview states traffic metrics are unavailable instead of inventing numbers', async () => {
    signedInAs(alice)
    keysApi.listApiKeys.mockResolvedValue([])
    mount('/')
    expect(await screen.findByText('No traffic metrics available')).toBeInTheDocument()
  })
})

describe('session expiry', () => {
  it('returns to login with a notice when an authenticated call reports 401', async () => {
    signedInAs(alice)
    keysApi.listApiKeys.mockImplementation(async () => {
      const { invalidateSession } = await import('../src/lib/session.js')
      invalidateSession('expired') // exactly what the Axios interceptor does on a 401
      throw new ApiError('Token has expired', { status: 401, kind: 'auth' })
    })
    mount('/api-keys')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument()
  })
})
