import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface RoomActivity {
  readonly unread: number
  readonly lastMessageAt: Date | null
}

/** Não lidas (mensagens do convidado após a última leitura) por sala ativa. */
export async function fetchRoomActivity(): Promise<Map<string, RoomActivity>> {
  const { data, error } = await supabase.rpc('admin_room_activity')
  if (error) throw new ServiceError('Não foi possível carregar a atividade.', { cause: error })
  return new Map(
    data.map((row) => [
      row.room_id,
      { unread: row.unread, lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null },
    ]),
  )
}

export async function markRoomRead(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_room_read', { p_room_id: roomId })
  if (error) throw new ServiceError('Não foi possível marcar como lida.', { cause: error })
}

export interface MessageNotice {
  readonly roomId: string
  readonly senderRole: 'admin' | 'guest'
  readonly createdAt: Date
}

/**
 * Avisos de mensagens novas em qualquer sala (só metadados; o conteúdo
 * continua cifrado e não é lido aqui). A RLS limita ao que o admin pode ver.
 */
export function subscribeToMessageNotices(onNotice: (notice: MessageNotice) => void): () => void {
  const channel = supabase
    .channel('admin-activity')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (change) => {
      const row = change.new as { room_id?: unknown; sender_role?: unknown; created_at?: unknown }
      if (typeof row.room_id !== 'string' || typeof row.created_at !== 'string') return
      if (row.sender_role !== 'admin' && row.sender_role !== 'guest') return
      onNotice({ roomId: row.room_id, senderRole: row.sender_role, createdAt: new Date(row.created_at) })
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
