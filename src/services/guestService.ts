import { FunctionsHttpError } from '@supabase/supabase-js'
import { deriveRoomKeys, parseInviteCode } from '../lib/crypto/index.ts'
import { toHex } from '../lib/crypto/encoding.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface GuestAccess {
  readonly roomId: string
  readonly roomKey: CryptoKey
}

const INVALID = 'Código inválido ou conversa expirada.'

/**
 * Entrada do convidado:
 *  1. valida o formato do código e deriva as chaves no navegador;
 *  2. abre uma sessão anônima nova (somente em memória);
 *  3. envia apenas o access_token à Edge Function join-room.
 */
export async function joinWithCode(input: string): Promise<GuestAccess> {
  let secret
  try {
    secret = parseInviteCode(input)
  } catch {
    throw new ServiceError(INVALID)
  }
  const { accessToken, roomKey } = await deriveRoomKeys(secret.bytes)

  // Sempre uma sessão anônima nova: nada de entrar automaticamente depois.
  await supabase.auth.signOut()
  const { error: authError } = await supabase.auth.signInAnonymously()
  if (authError) {
    throw new ServiceError(
      authError.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível conectar.',
      { cause: authError },
    )
  }

  const { data, error } = await supabase.functions.invoke<{ room_id: string }>('join-room', {
    body: { access_token: toHex(accessToken) },
  })

  if (error) {
    await supabase.auth.signOut()
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as { retry_after_seconds?: number }
        const minutes = Math.max(1, Math.ceil((body.retry_after_seconds ?? 900) / 60))
        throw new ServiceError(`Muitas tentativas. Tente novamente em ${minutes} min.`)
      }
      if (response.status === 404) throw new ServiceError(INVALID)
    }
    throw new ServiceError('Não foi possível entrar na conversa.', { cause: error })
  }
  if (!data?.room_id) {
    await supabase.auth.signOut()
    throw new ServiceError(INVALID)
  }

  return { roomId: data.room_id, roomKey }
}
