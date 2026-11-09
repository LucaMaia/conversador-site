import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

/**
 * Diferença (ms) entre o relógio do servidor e o do aparelho.
 * Compensa metade do tempo de ida e volta da requisição.
 */
export async function fetchServerClockOffset(): Promise<number> {
  const sentAt = Date.now()
  const { data, error } = await supabase.rpc('server_now')
  const receivedAt = Date.now()
  if (error || typeof data !== 'string') {
    throw new ServiceError('Não foi possível obter a hora do servidor.', { cause: error })
  }
  const serverTime = new Date(data).getTime()
  return serverTime - (sentAt + (receivedAt - sentAt) / 2)
}
