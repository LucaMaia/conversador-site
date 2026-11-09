import type { ChatMessage, SenderRole } from './chat.ts'

/** Tempo de acesso à imagem depois da primeira abertura pelo destinatário. */
export const MEDIA_VIEW_WINDOW_MS = 15 * 60 * 1000

export type MediaState =
  /** Ainda não aberta pelo destinatário: disponível até a conversa expirar. */
  | { kind: 'unviewed' }
  /** Aberta pelo destinatário: disponível até expiresAt. */
  | { kind: 'viewing'; expiresAt: Date; remainingMs: number }
  /** Prazo encerrado ou arquivo removido. */
  | { kind: 'expired' }

export function mediaState(message: ChatMessage, now: Date): MediaState {
  if (message.mediaPurged) return { kind: 'expired' }
  const expiresAt = message.mediaExpiresAt
  if (!expiresAt) return { kind: 'unviewed' }
  const remaining = expiresAt.getTime() - now.getTime()
  if (remaining <= 0) return { kind: 'expired' }
  return { kind: 'viewing', expiresAt, remainingMs: remaining }
}

/** Abrir uma imagem inicia a contagem apenas para quem a recebeu. */
export function openingStartsTimer(message: ChatMessage, myRole: SenderRole): boolean {
  return message.senderRole !== myRole && message.mediaViewedAt === null
}

/** "14:59" — minutos e segundos. */
export function formatMinutes(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
