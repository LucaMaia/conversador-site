// Limpeza física agendada (pg_cron, a cada minuto).
//   1) Salas vencidas ou excluídas: arquivos do Storage e linha da sala.
//   2) Fotos, vídeos e áudios abertos há mais de 15 minutos: arquivo do Storage.
//   3) Arquivos órfãos: upload sem mensagem há mais de 15 minutos.
//   4) Sessões anônimas órfãs e registros antigos de tentativas.
//
// Só atua sobre o que o próprio banco considera vencido, então chamadas
// extras não têm efeito. Não retorna dados de nenhuma sala.
import { createAdminClient } from '../_shared/adminClient.ts'
import { finalizeRoom } from '../_shared/purgeRoom.ts'

const BUCKET = 'attachments'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })

  const client = createAdminClient()
  const summary = { rooms: 0, media: 0, orphans: 0, failures: 0 }

  // 1) Salas
  const { data: roomIds, error: roomsError } = await client.rpc('purge_mark_expired')
  if (roomsError) {
    console.error('purge_mark_expired', roomsError)
    summary.failures++
  } else {
    for (const roomId of (roomIds ?? []) as string[]) {
      try {
        await finalizeRoom(client, roomId)
        summary.rooms++
      } catch (err) {
        console.error('finalizeRoom', roomId, err)
        summary.failures++
      }
    }
  }

  // 2) Imagens vencidas
  const { data: media, error: mediaError } = await client.rpc('purge_expired_media')
  if (mediaError) {
    console.error('purge_expired_media', mediaError)
    summary.failures++
  } else {
    const rows = (media ?? []) as { message_id: string; attachment_path: string }[]
    if (rows.length > 0) {
      const { error: removeError } = await client.storage.from(BUCKET).remove(rows.map((r) => r.attachment_path))
      if (removeError) {
        console.error('storage.remove', removeError)
        summary.failures++
      } else {
        const { error: doneError } = await client.rpc('purge_media_done', {
          p_message_ids: rows.map((r) => r.message_id),
        })
        if (doneError) {
          console.error('purge_media_done', doneError)
          summary.failures++
        } else {
          summary.media = rows.length
        }
      }
    }
  }

  // 3) Arquivos órfãos (upload sem mensagem há mais de 15 min)
  const { data: orphans, error: orphansError } = await client.rpc('purge_orphan_objects')
  if (orphansError) {
    console.error('purge_orphan_objects', orphansError)
    summary.failures++
  } else {
    const names = ((orphans ?? []) as { object_name: string }[]).map((o) => o.object_name)
    if (names.length > 0) {
      const { error: removeError } = await client.storage.from(BUCKET).remove(names)
      if (removeError) {
        console.error('storage.remove (órfãos)', removeError)
        summary.failures++
      } else {
        summary.orphans = names.length
      }
    }
  }

  // 4) Manutenção
  const { error: hkError } = await client.rpc('purge_housekeeping')
  if (hkError) {
    console.error('purge_housekeeping', hkError)
    summary.failures++
  }

  return new Response(JSON.stringify(summary), {
    status: summary.failures > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
