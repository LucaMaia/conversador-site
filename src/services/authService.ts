import { adminLoginToEmail, isValidAdminLogin } from '../domain/adminIdentity.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface AdminIdentity {
  readonly userId: string
}

const GENERIC_LOGIN_ERROR = 'Login ou senha inválidos.'

/**
 * Faz login e confirma, no banco, que o usuário está na tabela admins.
 * Um login válido de alguém que não é admin é desfeito imediatamente.
 */
export async function signInAdmin(login: string, password: string): Promise<AdminIdentity> {
  const normalized = login.trim().toLowerCase()
  if (!isValidAdminLogin(normalized) || password.length === 0) {
    throw new ServiceError(GENERIC_LOGIN_ERROR)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminLoginToEmail(normalized),
    password,
  })
  if (error || !data.user) {
    throw new ServiceError(
      error?.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : GENERIC_LOGIN_ERROR,
      { cause: error },
    )
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (adminError || !adminRow) {
    await supabase.auth.signOut()
    throw new ServiceError(GENERIC_LOGIN_ERROR, { cause: adminError })
  }

  return { userId: data.user.id }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
