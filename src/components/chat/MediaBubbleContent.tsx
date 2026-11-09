import { useCallback, useState, type ReactNode } from 'react'
import { formatDuration } from '../../domain/audio.ts'
import type { ChatMessage } from '../../domain/chat.ts'
import { formatMinutes, type MediaState } from '../../domain/ephemeralMedia.ts'
import type { MediaPayload } from '../../domain/messagePayload.ts'
import { AudioPlayer } from './AudioPlayer.tsx'
import { ImageViewer } from './ImageViewer.tsx'
import { useEphemeralMedia } from './useEphemeralMedia.ts'

interface Props {
  message: ChatMessage
  payload: MediaPayload
  mine: boolean
}

export function MediaBubbleContent(props: Props) {
  return props.payload.kind === 'audio' ? <AudioContent {...props} /> : <ImageContent {...props} />
}

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------
function ImageContent({ message, payload, mine }: Props) {
  const media = useEphemeralMedia(message, payload)
  const [viewer, setViewer] = useState<{ url: string; expiresAt: Date | null } | null>(null)
  const close = useCallback(() => setViewer(null), [])

  return (
    <>
      <MediaTile
        icon={<PhotoIcon />}
        state={media.state}
        loading={media.loading}
        error={media.error}
        disabled={message.pending}
        label={statusLabel({ title: 'Foto', ...PHOTO_TEXTS }, message, media.state, mine)}
        hint={!message.pending && media.state.kind === 'unviewed' && !mine ? 'Some 15 minutos depois de aberta' : null}
        onClick={async () => setViewer(await media.open())}
      />
      {viewer && media.state.kind !== 'expired' && (
        <ImageViewer url={viewer.url} expiresAt={viewer.expiresAt ?? message.mediaExpiresAt} onClose={close} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Áudio
// ---------------------------------------------------------------------------
function AudioContent({ message, payload, mine }: Props) {
  const media = useEphemeralMedia(message, payload)
  const [url, setUrl] = useState<string | null>(null)
  const duration = payload.durationMs ? formatDuration(payload.durationMs) : null

  if (url && media.state.kind !== 'expired') {
    return (
      <div className="flex min-w-56 flex-col gap-1">
        <AudioPlayer url={url} mime={payload.mime} fallbackDurationMs={payload.durationMs ?? 0} />
        {media.state.kind === 'viewing' && (
          <span className="text-[11px] text-ink-400">some em {formatMinutes(media.state.remainingMs)}</span>
        )}
      </div>
    )
  }

  return (
    <MediaTile
      icon={<MicIcon />}
      state={media.state}
      loading={media.loading}
      error={media.error}
      disabled={message.pending}
      label={statusLabel({ title: duration ? `Áudio · ${duration}` : 'Áudio', ...AUDIO_TEXTS }, message, media.state, mine)}
      hint={!message.pending && media.state.kind === 'unviewed' && !mine ? 'Some 15 minutos depois de ouvido' : null}
      onClick={async () => {
        const opened = await media.open()
        if (opened) setUrl(opened.url)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------
interface MediaTexts {
  /** Ex.: "Foto" ou "Áudio · 0:12" */
  readonly title: string
  readonly sending: string
  readonly expired: string
  readonly notOpened: string
  readonly action: string
}

const PHOTO_TEXTS = {
  sending: 'Enviando foto…',
  expired: 'Foto expirada',
  notOpened: 'não vista',
  action: 'toque para ver',
} as const

const AUDIO_TEXTS = {
  sending: 'Enviando áudio…',
  expired: 'Áudio expirado',
  notOpened: 'não ouvido',
  action: 'toque para ouvir',
} as const

function statusLabel(texts: MediaTexts, message: ChatMessage, state: MediaState, mine: boolean): string {
  if (message.pending) return texts.sending
  if (state.kind === 'expired') return texts.expired
  if (state.kind === 'viewing') return `${texts.title} · some em ${formatMinutes(state.remainingMs)}`
  return `${texts.title} · ${mine ? texts.notOpened : texts.action}`
}

interface MediaTileProps {
  icon: ReactNode
  state: MediaState
  loading: boolean
  error: string | null
  disabled: boolean
  label: string
  hint: string | null
  onClick: () => void
}

function MediaTile({ icon, state, loading, error, disabled, label, hint, onClick }: MediaTileProps) {
  const expired = state.kind === 'expired'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || expired || loading}
      className="flex min-w-44 items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5 text-left transition-colors enabled:hover:bg-black/30 disabled:cursor-default"
    >
      <span
        aria-hidden
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          expired ? 'bg-ink-700 text-ink-400' : 'bg-ink-50/10 text-ink-50'
        }`}
      >
        {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${expired ? 'text-ink-400 italic' : 'text-ink-50'}`}>{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
        {error && (
          <span role="alert" className="block text-[11px] text-danger-500">
            {error}
          </span>
        )}
      </span>
    </button>
  )
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MicIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  )
}
