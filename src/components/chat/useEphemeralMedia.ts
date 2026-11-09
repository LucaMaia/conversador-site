import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage } from '../../domain/chat.ts'
import { mediaState, openingStartsTimer, type MediaState } from '../../domain/ephemeralMedia.ts'
import type { MediaPayload } from '../../domain/messagePayload.ts'
import { ServiceError } from '../../services/errors.ts'
import { downloadMedia, markMediaViewed } from '../../services/mediaService.ts'
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

export interface EphemeralMedia {
  readonly state: MediaState
  readonly loading: boolean
  readonly error: string | null
  /**
   * Registra a abertura (inicia os 15 min para o destinatário), baixa e
   * decifra. Retorna a URL local (em memória) e o fim do acesso.
   */
  readonly open: () => Promise<{ url: string; expiresAt: Date | null } | null>
}

/**
 * Regra comum a fotos e áudios: disponível até ser aberto pelo destinatário;
 * depois, por 15 minutos. O prazo é imposto pelo servidor (RLS do Storage +
 * limpeza agendada); aqui só se exibe e se descarta a cópia local.
 */
export function useEphemeralMedia(message: ChatMessage, payload: MediaPayload): EphemeralMedia {
  const { roomId, roomKey, myRole, cache } = useRoomMedia()
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

  const open = useCallback(async () => {
    if (message.pending || state.kind === 'expired') return null
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
      return { url, expiresAt }
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Indisponível.')
      return null
    } finally {
      setLoading(false)
    }
  }, [message, payload, state.kind, myRole, cache, roomId, roomKey])

  return { state, loading, error, open }
}
