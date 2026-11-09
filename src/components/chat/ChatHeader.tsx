import { formatDateTime, formatRemaining, remainingMs } from '../../domain/rooms.ts'

interface ChatHeaderProps {
  title: string
  expiresAt: Date | null
  now: Date
  connected: boolean
  onLeave: () => void
  leaveLabel: string
}

export function ChatHeader({ title, expiresAt, now, connected, onLeave, leaveLabel }: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onLeave}
        className="-ml-1 rounded-md px-2 py-1 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
      >
        {leaveLabel}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-50">
          {title}
          <span
            className={`size-1.5 shrink-0 rounded-full ${connected ? 'bg-accent-500' : 'bg-ink-600'}`}
            title={connected ? 'Conectado' : 'Reconectando…'}
            aria-label={connected ? 'Conectado' : 'Reconectando'}
          />
        </p>
        {expiresAt && (
          <p className="truncate text-xs text-ink-400">Expira {formatDateTime(expiresAt)}</p>
        )}
      </div>
      {expiresAt && (
        <span className="font-mono text-sm tabular-nums text-ink-200" aria-label="Tempo restante">
          {formatRemaining(remainingMs(expiresAt, now))}
        </span>
      )}
    </header>
  )
}
