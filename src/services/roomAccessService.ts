import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface RoomInfo {
  readonly id: string
  readonly createdAt: Date
  readonly expiresAt: Date
}

/**
 * Informações da sala, somente se o usuário atual ainda tem acesso
 * (sala ativa, não expirada e — para o convidado — sessão não substituída).
 * Retorna null quando o acesso acabou.
 */
export async function fetchRoomInfo(roomId: string): Promise<RoomInfo | null> {
  const { data, error } = await supabase.rpc('get_room_info', { p_room_id: roomId })
  if (error) throw new ServiceError('Não foi possível verificar a conversa.', { cause: error })
  const row = data[0]
  if (!row) return null
  return { id: row.id, createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at) }
}
