import { ShieldCheck } from 'lucide-react'

export function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-400">
        <ShieldCheck className="size-5" aria-hidden />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-mist-100">SecureAI Gateway</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist-400">Operations console</p>
        </div>
      )}
    </div>
  )
}
