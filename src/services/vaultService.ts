import type { VaultRecord } from '../lib/crypto/index.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export async function fetchVaultRecord(userId: string): Promise<VaultRecord | null> {
  const { data, error } = await supabase
    .from('admin_vault')
    .select('kdf_salt, kdf_iterations, wrapped_master_key, wrap_iv')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new ServiceError('Não foi possível carregar o cofre.', { cause: error })
  return data
}

export async function saveVaultRecord(userId: string, record: VaultRecord): Promise<void> {
  const { error } = await supabase.from('admin_vault').insert({ user_id: userId, ...record })
  if (error) throw new ServiceError('Não foi possível criar o cofre.', { cause: error })
}
