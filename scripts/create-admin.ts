// Cria (ou atualiza a senha de) o administrador único.
// Executar localmente — NUNCA no navegador:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_LOGIN=admin-lm729 ADMIN_PASSWORD='...' \
//   npm run create-admin
//
// A senha é enviada ao Supabase Auth, que a armazena com hash bcrypt.
// Ela não é gravada em nenhum arquivo do projeto.
import { createClient } from '@supabase/supabase-js'
import { adminLoginToEmail } from '../src/domain/adminIdentity.ts'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Variável de ambiente obrigatória ausente: ${name}`)
    process.exit(1)
  }
  return value
}

const url = requireEnv('SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

if (serviceRoleKey.startsWith('sb_publishable_')) {
  console.error('Foi informada a publishable key. Use a secret key (sb_secret_...).')
  process.exit(1)
}
const login = requireEnv('ADMIN_LOGIN')
const password = requireEnv('ADMIN_PASSWORD')

if (password.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

const email = adminLoginToEmail(login)
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserIdByEmail(target: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === target)
    if (found) return found.id
    if (data.users.length < 200) return null
  }
}

async function main(): Promise<void> {
  let userId = await findUserIdByEmail(email)

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) throw error
    console.log('Administrador existente: senha atualizada.')
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { provisioned: 'admin-seed' },
    })
    if (error) throw error
    userId = data.user.id
    console.log('Administrador criado.')
  }

  const { error: upsertError } = await admin
    .from('admins')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
  if (upsertError) throw upsertError

  console.log(`Login: ${login}`)
}

main().catch((err: unknown) => {
  console.error('Falha ao criar administrador:', err instanceof Error ? err.message : err)
  process.exit(1)
})
