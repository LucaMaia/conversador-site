// Exclusão manual imediata de uma sala pelo administrador.
// POST { room_id } com o JWT do admin no cabeçalho Authorization.
import { corsHeaders, json } from '../_shared/cors.ts'
import { createAdminClient, requireAdmin, UUID_RE } from '../_shared/adminClient.ts'
import { finalizeRoom } from '../_shared/purgeRoom.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })

  const client = createAdminClient()
  const adminId = await requireAdmin(client, req)
  if (!adminId) return json(req, 403, { error: 'forbidden' })

  let roomId: unknown
  try {
    roomId = ((await req.json()) as { room_id?: unknown }).room_id
  } catch {
    return json(req, 400, { error: 'invalid_body' })
  }
  if (typeof roomId !== 'string' || !UUID_RE.test(roomId)) {
    return json(req, 400, { error: 'invalid_room_id' })
  }

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
