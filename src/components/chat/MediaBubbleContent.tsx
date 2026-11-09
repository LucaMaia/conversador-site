import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage } from '../../domain/chat.ts'
import { formatMinutes, mediaState, openingStartsTimer } from '../../domain/ephemeralMedia.ts'
import type { MediaPayload } from '../../domain/messagePayload.ts'
import { ServiceError } from '../../services/errors.ts'
import { downloadMedia, markMediaViewed } from '../../services/mediaService.ts'
import { ImageViewer } from './ImageViewer.tsx'
import { useRoomMedia } from './roomMediaContext.tsx'

/** Relógio local, ativo só enquanto há contagem na tela. */
function useTicker(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

export function MediaBubbleContent({ message, payload, mine }: { message: ChatMessage; payload: MediaPayload; mine: boolean }) {
  const { roomId, roomKey, myRole, cache } = useRoomMedia()
  const [openUrl, setOpenUrl] = useState<string | null>(null)
  const [viewerExpiresAt, setViewerExpiresAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = useTicker(message.mediaExpiresAt !== null && !message.mediaPurged)
  const state = mediaState(message, now)

  // Prazo encerrado: descarta a cópia decifrada da memória.
  useEffect(() => {
    if (state.kind !== 'expired') return
    const cached = cache.get(message.id)
    if (cached) {
      URL.revokeObjectURL(cached)
      cache.delete(message.id)
    }
  }, [state.kind, cache, message.id])

  const close = useCallback(() => setOpenUrl(null), [])

  async function open() {
    if (message.pending || state.kind === 'expired' || loading) return
    setLoading(true)
    setError(null)
    try {
      let expiresAt = message.mediaExpiresAt
      if (openingStartsTimer(message, myRole)) {
        expiresAt = await markMediaViewed(message.id)
      }
      let url = cache.get(message.id)
      if (!url) {
        url = URL.createObjectURL(await downloadMedia(roomId, roomKey, payload))
        cache.set(message.id, url)
      }
      setViewerExpiresAt(expiresAt)
      setOpenUrl(url)
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Imagem indisponível.')
    } finally {
      setLoading(false)
    }
  }

  const label = message.pending
    ? 'Enviando foto…'
    : state.kind === 'expired'
      ? 'Foto expirada'
      : state.kind === 'viewing'
        ? `Foto · some em ${formatMinutes(state.remainingMs)}`
        : mine
          ? 'Foto · não vista'
          : 'Foto · toque para ver'

  const hint =
    !message.pending && state.kind === 'unviewed' && !mine ? 'Some 15 minutos depois de aberta' : null

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={message.pending || state.kind === 'expired'}
        className="flex min-w-44 items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5 text-left transition-colors enabled:hover:bg-black/30 disabled:cursor-default"
      >
        <span
          aria-hidden
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            state.kind === 'expired' ? 'bg-ink-700 text-ink-400' : 'bg-ink-50/10 text-ink-50'
          }`}
        >
          {loading ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m21 16-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0">
          <span className={`block text-sm ${state.kind === 'expired' ? 'text-ink-400 italic' : 'text-ink-50'}`}>
            {label}
          </span>
          {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
          {error && (
            <span role="alert" className="block text-[11px] text-danger-500">
              {error}
            </span>
          )}
        </span>
      </button>
      {openUrl && state.kind !== 'expired' && <ImageViewer url={openUrl} expiresAt={viewerExpiresAt ?? message.mediaExpiresAt} onClose={close} />}
    </>
  )
}
