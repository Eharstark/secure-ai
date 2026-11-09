import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { EmptyState, Spinner } from './ui'

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner label="Verifying session…" />
    </div>
  )
}

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenSpinner />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Redirects signed-in users away from /login and /register.
export function PublicOnlyRoute() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

// UI-level gate only. The real enforcement is on the server (403 for non-admins); a non-admin who
// guesses the URL sees this page and every admin API call would be refused anyway.
export function AdminRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldOff} title="Administrator access required">
        Your account does not have permission to view this page. Ask an administrator if you need access.
      </EmptyState>
    )
  }
  return <Outlet />
}
