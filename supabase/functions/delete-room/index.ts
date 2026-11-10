// Exclusão imediata de uma sala (para os dois participantes).
// POST { room_id } com o JWT no cabeçalho Authorization.
//
// Quem pode excluir:
//  * o administrador: qualquer sala;
//  * o convidado: somente a sala em que é o convidado atual (entrou com o
//    código e a sessão não foi substituída), e só enquanto ela estiver ativa.
import { corsHeaders, json } from '../_shared/cors.ts'
import { bearerToken, createAdminClient, UUID_RE } from '../_shared/adminClient.ts'
import { finalizeRoom } from '../_shared/purgeRoom.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

async function canDeleteRoom(client: SupabaseClient, req: Request, roomId: string): Promise<boolean> {
  const token = bearerToken(req)
  if (!token) return false
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return false
  const userId = data.user.id

  if (!data.user.is_anonymous) {
    const { data: admin } = await client.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
    return admin !== null
  }

  // Convidado: precisa ser o membro atual de uma sala ativa e não vencida.
  const { data: membership } = await client
    .from('room_members')
    .select('room_id, rooms!inner(status, expires_at)')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return false
  const room = (membership as { rooms: { status: string; expires_at: string } }).rooms
  return room.status === 'active' && new Date(room.expires_at).getTime() > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })

  let roomId: unknown
  try {
    roomId = ((await req.json()) as { room_id?: unknown }).room_id
  } catch {
    return json(req, 400, { error: 'invalid_body' })
  }
  if (typeof roomId !== 'string' || !UUID_RE.test(roomId)) {
    return json(req, 400, { error: 'invalid_room_id' })
  }

  const client = createAdminClient()
  if (!(await canDeleteRoom(client, req, roomId))) return json(req, 403, { error: 'forbidden' })

  // 1) Bloqueia o acesso e apaga mensagens/participação imediatamente.
  const { data: marked, error: markError } = await client.rpc('purge_mark_room', { p_room_id: roomId })
  if (markError) return json(req, 500, { error: 'purge_failed' })
  if (!marked) return json(req, 404, { deleted: false })

  // 2) Arquivos e linha da sala. Em caso de falha, o cron conclui depois.
  try {
    await finalizeRoom(client, roomId)
  } catch (err) {
    console.error('delete-room: limpeza parcial, será concluída pelo cron', err)
    return json(req, 202, { deleted: true, pending_cleanup: true })
  }

  return json(req, 200, { deleted: true })
})
