import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, cx, inputClass } from '../components/ui'
import { passwordStrength, validateNewPassword, validateUsername } from '../lib/validation'

const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

export default function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const strength = passwordStrength(password)

  async function onSubmit(e) {
    e.preventDefault()
    const v = {}
    const u = validateUsername(username)
    if (u) v.username = u
    const p = validateNewPassword(password, username)
    if (p) v.password = p
    if (password !== confirm) v.confirm = 'Passwords do not match.'
    setErrors(v)
    setFormError(null)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      await authApi.register(username.trim(), password)
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setErrors(err.fieldErrors || {})
      setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="New accounts always receive the standard user role."
      footer={<>Already registered? <Link to="/login" className="font-medium text-accent-400 hover:text-accent-300">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Username" id="username" error={errors.username} hint="3–32 characters: letters, digits, . _ -  (case-insensitive)">
          <input id="username" className={inputClass(errors.username)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} aria-invalid={!!errors.username} autoFocus />
        </Field>
        <Field label="Password" id="password" error={errors.password} hint="At least 12 characters; must not contain your username.">
          <input id="password" type="password" className={inputClass(errors.password)} autoComplete="new-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
          {password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cx('h-1 flex-1 rounded-full', i < strength ? (strength <= 1 ? 'bg-rose-400' : strength === 2 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-ink-700')} />
                ))}
              </div>
              <span className="text-xs text-mist-400">{STRENGTH[strength]}</span>
            </div>
          )}
        </Field>
        <Field label="Confirm password" id="confirm" error={errors.confirm}>
          <input id="confirm" type="password" className={inputClass(errors.confirm)} autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </AuthShell>
  )
}
