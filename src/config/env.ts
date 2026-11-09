// Somente valores públicos por design. A chave publishable (anon) do Supabase
// não concede acesso por si só: toda autorização é feita pelas políticas RLS.
// NUNCA coloque a service_role key em variáveis VITE_*.

interface PublicEnv {
  supabaseUrl: string
  supabasePublishableKey: string
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }
  return value
}

export const env: PublicEnv = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
}
