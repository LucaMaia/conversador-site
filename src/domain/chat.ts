import type { MessagePayload } from './messagePayload.ts'

export type SenderRole = 'admin' | 'guest'

/** Mensagem pronta para exibir (já decifrada, ou marcada como ilegível). */
export interface ChatMessage {
  readonly id: string
  readonly senderRole: SenderRole
  readonly createdAt: Date
  readonly payload: MessagePayload | null
  /** Enviada por mim e ainda não confirmada pelo servidor. */
  readonly pending: boolean
  /** Caminho do arquivo cifrado no Storage (mensagens de mídia). */
  readonly attachmentPath: string | null
  /** Primeira abertura pelo destinatário (definida pelo servidor). */
  readonly mediaViewedAt: Date | null
  /** Fim do acesso à mídia: 15 min após a primeira abertura. */
  readonly mediaExpiresAt: Date | null
  /** Arquivo já removido do servidor. */
  readonly mediaPurged: boolean
}

/**
 * Junta mensagens novas à lista, sem duplicar (o eco do realtime substitui
 * a versão otimista) e em ordem cronológica do servidor.
 */
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const m of current) byId.set(m.id, m)
  for (const m of incoming) {
    const existing = byId.get(m.id)
    if (!existing || existing.pending || !m.pending) byId.set(m.id, m)
  }
  return [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function formatMessageTime(date: Date): string {
  return timeFormat.format(date)
}
