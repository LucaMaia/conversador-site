import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'attachments'
const PAGE = 100

/** Remove todos os objetos da pasta da sala no Storage (pela API, não por SQL). */
export async function removeRoomFiles(client: SupabaseClient, roomId: string): Promise<number> {
  let removed = 0
  for (;;) {
    const { data, error } = await client.storage.from(BUCKET).list(roomId, { limit: PAGE })
    if (error) throw new Error(`storage.list: ${error.message}`)
    if (!data || data.length === 0) return removed

    const paths = data.map((obj) => `${roomId}/${obj.name}`)
    const { error: removeError } = await client.storage.from(BUCKET).remove(paths)
    if (removeError) throw new Error(`storage.remove: ${removeError.message}`)
    removed += paths.length
  }
}

/**
 * Conclui a limpeza de uma sala já marcada como 'purging':
 * arquivos do Storage primeiro, depois a linha da sala (cascata no banco).
 * Se algo falhar, a sala continua 'purging' e a próxima execução tenta de novo.
 */
export async function finalizeRoom(client: SupabaseClient, roomId: string): Promise<void> {
  await removeRoomFiles(client, roomId)
  const { error } = await client.rpc('purge_finalize_room', { p_room_id: roomId })
  if (error) throw new Error(`purge_finalize_room: ${error.message}`)
}
