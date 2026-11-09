// @vitest-environment node
import { CryptoError } from './errors.ts'
import { generateInviteSecret, parseInviteCode } from './inviteCode.ts'

describe('código de convite', () => {
  it('tem 6 grupos de 4 caracteres Crockford e 120 bits', () => {
    const { code, bytes } = generateInviteSecret()
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/)
    expect(bytes.length).toBe(15)
  })

  it('não se repete', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateInviteSecret().code))
    expect(codes.size).toBe(2000)
  })

  it('aceita o código digitado com minúsculas, espaços e confusões O/I/L', () => {
    const { code, bytes } = generateInviteSecret()
    const typed = ` ${code.toLowerCase().replace(/-/g, ' ')} `.replace(/0/g, 'o').replace(/1/g, 'l')
    const parsed = parseInviteCode(typed)
    expect(parsed.code).toBe(code)
    expect(parsed.bytes).toEqual(bytes)
  })

  it('rejeita códigos malformados', () => {
    for (const bad of ['', 'ABCD', 'UUUU-UUUU-UUUU-UUUU-UUUU-UUUU', 'ABCD-ABCD-ABCD-ABCD-ABCD-ABCD-A']) {
      expect(() => parseInviteCode(bad)).toThrow(CryptoError)
    }
  })
})
