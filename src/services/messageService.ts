import type { ChatMessage } from '../domain/chat.ts'
import type { MessagePayload } from '../domain/messagePayload.ts'
import { decryptMessage, encryptMessage } from '../lib/crypto/index.ts'
import type { Database } from './database.types.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

type MessageRow = Database['public']['Tables']['messages']['Row']

const COLUMNS =
  'id, room_id, sender_id, sender_role, ciphertext, iv, attachment_path, created_at, media_viewed_at, media_expires_at, media_purged'

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null
}

async function toChatMessage(roomKey: CryptoKey, row: MessageRow): Promise<ChatMessage> {
  let payload: MessagePayload | null = null
  try {
    payload = await decryptMessage(roomKey, row.room_id, row.id, { ciphertext: row.ciphertext, iv: row.iv })
  } catch {
    payload = null // exibida como "mensagem ilegível"
  }
  return {
    id: row.id,
    senderRole: row.sender_role,
    createdAt: new Date(row.created_at),
    payload,
    pending: false,
    attachmentPath: row.attachment_path,
    mediaViewedAt: toDate(row.media_viewed_at),
    mediaExpiresAt: toDate(row.media_expires_at),
    mediaPurged: row.media_purged,
  }
}

export async function fetchMessages(roomId: string, roomKey: CryptoKey): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(2000)
  if (error) throw new ServiceError('Não foi possível carregar as mensagens.', { cause: error })
  return Promise.all(data.map((row) => toChatMessage(roomKey, row)))
}

/** Cifra no navegador e envia. Retorna a mensagem confirmada pelo servidor. */
export async function sendMessage(
  roomId: string,
  roomKey: CryptoKey,
  messageId: string,
  payload: MessagePayload,
  attachmentPath: string | null = null,
): Promise<ChatMessage> {
  const encrypted = await encryptMessage(roomKey, roomId, messageId, payload)
  const { data, error } = await supabase
    .from('messages')
    .insert({ id: messageId, room_id: roomId, ...encrypted, attachment_path: attachmentPath })
    .select(COLUMNS)
    .single()
  if (error) throw new ServiceError('Mensagem não enviada.', { cause: error })
  return toChatMessage(roomKey, data)
}

/**
 * Recebe mensagens novas e atualizações (ex.: imagem vista) em tempo real.
 * O Realtime aplica a RLS: só chega o que o usuário pode ler.
 */
export function subscribeToMessages(
  roomId: string,
  roomKey: CryptoKey,
  onMessage: (message: ChatMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const handle = (row: MessageRow) => {
    void toChatMessage(roomKey, row).then(onMessage)
  }
  const filter = `room_id=eq.${roomId}`
  const channel = supabase
    .channel(`messages:${roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (change) =>
      handle(change.new as MessageRow),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (change) =>
      handle(change.new as MessageRow),
    )
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'))

  return () => {
    void supabase.removeChannel(channel)
  }
}
