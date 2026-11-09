import type { ChatMessage } from '../domain/chat.ts'
import type { MessagePayload } from '../domain/messagePayload.ts'
import { decryptMessage, encryptMessage } from '../lib/crypto/index.ts'
import type { Database } from './database.types.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

type MessageRow = Database['public']['Tables']['messages']['Row']

const COLUMNS = 'id, room_id, sender_id, sender_role, ciphertext, iv, attachment_path, created_at'

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

/** Recebe mensagens novas em tempo real (o Realtime aplica a RLS). */
export function subscribeToMessages(
  roomId: string,
  roomKey: CryptoKey,
  onMessage: (message: ChatMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const channel = supabase
    .channel(`messages:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (change) => {
        void toChatMessage(roomKey, change.new as MessageRow).then(onMessage)
      },
    )
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'))

  return () => {
    void supabase.removeChannel(channel)
  }
}
