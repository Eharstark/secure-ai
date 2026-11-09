import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Bot, Gauge, KeyRound, LayoutDashboard, LogOut, Menu, ScrollText, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as authApi from '../api/auth'
import { Brand } from './Brand'
import { Badge, cx } from './ui'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/api-keys', label: 'API keys', icon: KeyRound },
  { to: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
]
const MONITORING = [
  { to: '/monitoring/rate-limits', label: 'Rate limits', icon: Gauge },
  { to: '/monitoring/security-events', label: 'Security events', icon: ScrollText },
  { to: '/monitoring/ai-service', label: 'AI service', icon: Bot },
]

function NavItem({ item, soon }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-accent-500/10 text-accent-300 ring-1 ring-inset ring-accent-500/25' : 'text-mist-300 hover:bg-ink-800 hover:text-mist-100',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {soon && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mist-400">Soon</span>}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }) {
  const { user, isAdmin, logout } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5"><Brand /></div>
      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" onClick={onNavigate}>
        <div className="space-y-1">
          {NAV.filter((i) => !i.adminOnly || isAdmin).map((i) => <NavItem key={i.to} item={i} />)}
        </div>
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mist-400">Monitoring</p>
          <div className="space-y-1">{MONITORING.map((i) => <NavItem key={i.to} item={i} soon />)}</div>
        </div>
      </nav>
      <div className="border-t border-ink-700/70 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800 text-sm font-semibold uppercase text-accent-300">
            {user.username.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-mist-100">{user.username}</p>
            <p className="text-xs capitalize text-mist-400">{user.role}</p>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-mist-400 hover:bg-ink-800 hover:text-rose-300">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Live backend reachability from GET /health (the only public status endpoint that exists).
function HealthPill() {
  const [state, setState] = useState({ status: 'checking' })
  useEffect(() => {
    let alive = true
    const check = () =>
      authApi
        .fetchHealth()
        .then((h) => alive && setState({ status: 'ok', version: h.version }))
        .catch(() => alive && setState({ status: 'down' }))
    check()
    const id = setInterval(check, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  if (state.status === 'checking') return <Badge>Checking API…</Badge>
  if (state.status === 'down') return <Badge tone="red"><Activity className="size-3" /> API unreachable</Badge>
  return <Badge tone="green"><span className="size-1.5 rounded-full bg-emerald-400" /> API online · v{state.version}</Badge>
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-ink-700/70 bg-ink-900/80 backdrop-blur lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/80" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-ink-700 bg-ink-900 shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-mist-400 hover:bg-ink-800"><X className="size-5" /></button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-700/70 bg-ink-900/80 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-mist-300 hover:bg-ink-800 lg:hidden"><Menu className="size-5" /></button>
          <div className="lg:hidden"><Brand compact /></div>
          <div className="ml-auto"><HealthPill /></div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
