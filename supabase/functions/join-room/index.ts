// Entrada do convidado com o código.
// POST { access_token: <hex de 64 caracteres> } com o JWT da sessão anônima.
//
// O servidor recebe apenas o access_token (derivado do código via HKDF) e
// compara SHA-256(access_token) com rooms.access_hash. A chave de cifra da
// sala é outra saída do HKDF e nunca chega aqui.
//
// Limite de tentativas: 5 falhas a cada 15 minutos por IP (função join_room).
// O IP é guardado apenas como HMAC-SHA256 com o secret IP_HASH_SECRET.
import { corsHeaders, json } from '../_shared/cors.ts'
import { bearerToken, createAdminClient } from '../_shared/adminClient.ts'

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

// Prioriza cabeçalhos definidos pela infraestrutura (não pelo cliente).
// Mesmo que um atacante varie o IP, o código tem 120 bits: o limite de
// tentativas é uma camada extra, não a proteção principal.
function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })

  const ipSecret = Deno.env.get('IP_HASH_SECRET')
  if (!ipSecret) return json(req, 500, { error: 'server_misconfigured' })

  const client = createAdminClient()
  const token = bearerToken(req)
  if (!token) return json(req, 401, { error: 'unauthorized' })
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return json(req, 401, { error: 'unauthorized' })

  let accessToken: unknown
  try {
    accessToken = ((await req.json()) as { access_token?: unknown }).access_token
  } catch {
    return json(req, 400, { error: 'invalid_body' })
  }
  if (typeof accessToken !== 'string' || !/^[0-9a-f]{64}$/.test(accessToken)) {
    return json(req, 400, { error: 'invalid_body' })
  }

  const accessHash = toHex(await crypto.subtle.digest('SHA-256', hexToBytes(accessToken)))
  const ipHash = await hmacHex(ipSecret, clientIp(req))

  const { data, error } = await client.rpc('join_room', {
    p_user_id: userData.user.id,
    p_access_hash: accessHash,
    p_ip_hash: ipHash,
  })
  if (error || typeof data !== 'object' || data === null) {
    console.error('join-room: falha no join_room', error)
    return json(req, 500, { error: 'join_failed' })
  }

  const result = data as { status: string; room_id?: string; expires_at?: string; retry_after_seconds?: number }
  switch (result.status) {
    case 'ok':
      return json(req, 200, { room_id: result.room_id, expires_at: result.expires_at })
    case 'rate_limited':
      return json(req, 429, { error: 'rate_limited', retry_after_seconds: result.retry_after_seconds })
    case 'forbidden':
      return json(req, 403, { error: 'forbidden' })
    default:
      return json(req, 404, { error: 'invalid_code' })
  }
})
