// @vitest-environment node
import { fromBase64, fromCrockford, randomBytes, toBase64, toCrockford, toHex, utf8Decode, utf8Encode } from './encoding.ts'

describe('encoding', () => {
  it('base64 ida e volta, inclusive para dados grandes', () => {
    for (const size of [0, 1, 2, 3, 100, 200_000]) {
      const data = randomBytes(size)
      expect(fromBase64(toBase64(data))).toEqual(data)
    }
  })

  it('base64 compatível com a implementação do Node', () => {
    const data = randomBytes(1000)
    expect(toBase64(data)).toBe(Buffer.from(data).toString('base64'))
  })

  it('rejeita base64 inválido', () => {
    expect(() => fromBase64('abc')).toThrow()
    expect(() => fromBase64('ab$=')).toThrow()
  })

  it('crockford ida e volta', () => {
    const data = randomBytes(15)
    const encoded = toCrockford(data)
    expect(encoded).toMatch(/^[0-9A-HJKMNP-TV-Z]{24}$/)
    expect(fromCrockford(encoded, 15)).toEqual(data)
  })

  it('crockford rejeita comprimento ou caractere inválido', () => {
    expect(() => fromCrockford('0'.repeat(23), 15)).toThrow()
    expect(() => fromCrockford('U'.repeat(24), 15)).toThrow()
  })

  it('utf8 e hex', () => {
    expect(utf8Decode(utf8Encode('olá 👋'))).toBe('olá 👋')
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })
})
