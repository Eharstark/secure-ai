import { Brand } from './Brand'
import { Card } from './ui'

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Brand /></div>
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-mist-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-mist-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <p className="mt-5 text-center text-sm text-mist-400">{footer}</p>}
        <p className="mt-8 text-center text-xs text-ink-500">Credentials are sent only to your SecureAI Gateway API.</p>
      </div>
    </div>
  )
}
