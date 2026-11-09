// O Supabase Auth exige e-mail; o login do admin é mapeado para um endereço
// interno em domínio reservado (.invalid), que nunca recebe e-mails.
const ADMIN_EMAIL_DOMAIN = 'admin.invalid'
const LOGIN_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/

export function isValidAdminLogin(login: string): boolean {
  return LOGIN_PATTERN.test(login)
}

export function adminLoginToEmail(login: string): string {
  const normalized = login.trim().toLowerCase()
  if (!isValidAdminLogin(normalized)) {
    throw new Error('Login de administrador inválido')
  }
  return `${normalized}@${ADMIN_EMAIL_DOMAIN}`
}
