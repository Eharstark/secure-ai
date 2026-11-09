import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, X } from 'lucide-react'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function Card({ className, children, ...rest }) {
  return (
    <section className={cx('rounded-xl border border-ink-700/80 bg-ink-850/80 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] backdrop-blur-sm', className)} {...rest}>
      {children}
    </section>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-700/70 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-wide text-mist-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-mist-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-mist-100 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

const buttonStyles = {
  primary: 'bg-accent-500 text-ink-950 hover:bg-accent-400 disabled:hover:bg-accent-500 font-semibold',
  secondary: 'border border-ink-600 bg-ink-800 text-mist-100 hover:border-ink-500 hover:bg-ink-700',
  danger: 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  ghost: 'text-mist-300 hover:bg-ink-800 hover:text-mist-100',
}

export function Button({ variant = 'secondary', loading = false, icon: Icon, className, children, disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50', buttonStyles[variant], className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  )
}

const badgeTones = {
  cyan: 'border-accent-500/30 bg-accent-500/10 text-accent-300',
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  slate: 'border-ink-600 bg-ink-800 text-mist-300',
}
export function Badge({ tone = 'slate', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', badgeTones[tone], className)}>{children}</span>
}

export function Spinner({ label = 'Loading…', className }) {
  return (
    <div role="status" className={cx('flex items-center justify-center gap-2 py-10 text-sm text-mist-400', className)}>
      <Loader2 className="size-4 animate-spin text-accent-400" aria-hidden /> {label}
    </div>
  )
}

const alertStyles = {
  error: ['border-rose-500/30 bg-rose-500/10 text-rose-200', AlertTriangle],
  warning: ['border-amber-500/30 bg-amber-500/10 text-amber-200', AlertTriangle],
  info: ['border-accent-500/30 bg-accent-500/10 text-accent-300', Info],
  success: ['border-emerald-500/30 bg-emerald-500/10 text-emerald-200', CheckCircle2],
}
export function Alert({ tone = 'info', title, children, onDismiss, action, className }) {
  const [style, Icon] = alertStyles[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', style, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="h-fit rounded p-0.5 opacity-70 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl border border-ink-600 bg-ink-800 text-accent-400">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <h3 className="text-sm font-semibold text-mist-100">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-mist-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'cyan' }) {
  const iconTone = { cyan: 'text-accent-400', green: 'text-emerald-400', amber: 'text-amber-400', red: 'text-rose-400', slate: 'text-mist-400' }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-mist-400">{label}</p>
        {Icon && <Icon className={cx('size-4', iconTone)} aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-mist-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-mist-400">{hint}</p>}
    </Card>
  )
}

export function Field({ label, id, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-mist-200">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">{error}</p> : hint ? <p className="mt-1.5 text-xs text-mist-400">{hint}</p> : null}
    </div>
  )
}

export const inputClass = (invalid) =>
  cx(
    'block w-full rounded-lg border bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 transition-colors',
    invalid ? 'border-rose-500/60' : 'border-ink-600 hover:border-ink-500 focus:border-accent-500',
  )

export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !loading && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-xl border border-ink-600 bg-ink-850 p-5 shadow-2xl">
        <h2 id="confirm-title" className="text-base font-semibold text-mist-100">{title}</h2>
        <div className="mt-2 text-sm text-mist-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy' }) {
  const [state, setState] = useState('idle')
  async function copy() {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts (e.g. http://<LAN IP>): select-and-copy via a temporary textarea.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!ok) throw new Error('copy failed')
      }
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }
  return (
    <Button variant="secondary" onClick={copy} icon={state === 'copied' ? Check : Copy}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed — select manually' : label}
    </Button>
  )
}
