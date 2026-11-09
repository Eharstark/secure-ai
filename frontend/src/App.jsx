import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminRoute, FullScreenSpinner, ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import Login from './pages/Login'
import Register from './pages/Register'
const Overview = lazy(() => import('./pages/Overview'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const Users = lazy(() => import('./pages/Users'))
const Planned = lazy(() => import('./pages/Planned'))
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route element={<AdminRoute />}>
            <Route path="admin/users" element={<Users />} />
          </Route>
          <Route path="monitoring" element={<Navigate to="/monitoring/rate-limits" replace />} />
          <Route path="monitoring/rate-limits" element={<Planned id="rate-limits" />} />
          <Route path="monitoring/security-events" element={<Planned id="security-events" />} />
          <Route path="monitoring/ai-service" element={<Planned id="ai-service" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}
