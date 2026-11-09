import { adminLoginToEmail, isValidAdminLogin } from './adminIdentity.ts'

describe('adminLoginToEmail', () => {
  it('mapeia o login para o e-mail interno', () => {
    expect(adminLoginToEmail('admin-lm729')).toBe('admin-lm729@admin.invalid')
  })

  it('normaliza espaços e maiúsculas', () => {
    expect(adminLoginToEmail('  Admin-LM729 ')).toBe('admin-lm729@admin.invalid')
  })

  it('rejeita logins com caracteres que poderiam injetar outro domínio', () => {
    expect(isValidAdminLogin('a@evil.com')).toBe(false)
    expect(() => adminLoginToEmail('a@evil.com')).toThrow()
    expect(() => adminLoginToEmail('')).toThrow()
  })
})
