import type { MessagePayload } from './messagePayload.ts'

export type SenderRole = 'admin' | 'guest'

/** 'system' = mensagem oficial gerada pelo banco (ex.: boas-vindas). */
export type MessageAuthor = SenderRole | 'system'

/** Mensagem pronta para exibir (já decifrada, ou marcada como ilegível). */
export interface ChatMessage {
  readonly id: string
  readonly senderRole: MessageAuthor
  readonly createdAt: Date
  /** Modelo da mensagem do sistema (o texto vive no código, não no banco). */
  readonly systemTemplate: string | null
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
  // Em caso de empate no horário, a mensagem do sistema vem primeiro.
  const systemFirst = (m: ChatMessage) => (m.senderRole === 'system' ? 0 : 1)
  return [...byId.values()].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || systemFirst(a) - systemFirst(b) || a.id.localeCompare(b.id),
  )
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function formatMessageTime(date: Date): string {
  return timeFormat.format(date)
}
