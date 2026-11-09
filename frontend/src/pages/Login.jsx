import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, inputClass } from '../components/ui'

export default function Login() {
  const { login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const justRegistered = location.state?.registered

  async function onSubmit(e) {
    e.preventDefault()
    const v = {}
    if (!username.trim()) v.username = 'Enter your username.'
    if (!password) v.password = 'Enter your password.'
    setErrors(v)
    setFormError(null)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      await login(username.trim(), password)
      navigate(location.state?.from && location.state.from !== '/login' ? location.state.from : '/', { replace: true })
    } catch (err) {
      // The server returns one identical message for unknown user / wrong password / disabled account.
      setFormError(err.message)
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access the SecureAI Gateway console."
      footer={<>No account yet? <Link to="/register" className="font-medium text-accent-400 hover:text-accent-300">Create one</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {notice && <Alert tone="warning" onDismiss={clearNotice}>{notice}</Alert>}
        {justRegistered && !notice && <Alert tone="success">Account created. Sign in to continue.</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Username" id="username" error={errors.username}>
          <input id="username" className={inputClass(errors.username)} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} aria-invalid={!!errors.username} aria-describedby={errors.username ? 'username-error' : undefined} autoFocus />
        </Field>
        <Field label="Password" id="password" error={errors.password}>
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} className={inputClass(errors.password) + ' pr-10'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-2 my-auto h-8 rounded p-1.5 text-mist-400 hover:text-mist-100">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </AuthShell>
  )
}
