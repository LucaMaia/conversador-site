import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { env } from '../config/env.ts'

// Sessões existem somente em memória: ao recarregar ou reabrir o site,
// o participante precisa informar o código novamente e o admin precisa
// fazer login e desbloquear o cofre outra vez.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
