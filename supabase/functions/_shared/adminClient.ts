import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Cliente com service_role: usado SOMENTE dentro das Edge Functions.
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Configuração do servidor ausente')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? null
}

/** Retorna o id do usuário do JWT se ele for o admin; caso contrário, null. */
export async function requireAdmin(client: SupabaseClient, req: Request): Promise<string | null> {
  const token = bearerToken(req)
  if (!token) return null
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user || data.user.is_anonymous) return null

  const { data: row, error: rowError } = await client
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (rowError || !row) return null
  return data.user.id
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
