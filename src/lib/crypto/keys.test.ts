// @vitest-environment node
import { createHash, hkdfSync } from 'node:crypto'
import { randomBytes, utf8Encode } from './encoding.ts'
import { generateInviteSecret } from './inviteCode.ts'
import { deriveRoomKeys } from './keys.ts'

describe('derivação de chaves', () => {
  it('é determinística para o mesmo código', async () => {
    const { bytes } = generateInviteSecret()
    const a = await deriveRoomKeys(bytes)
    const b = await deriveRoomKeys(bytes)
    expect(a.accessHash).toBe(b.accessHash)
    expect(a.accessToken).toEqual(b.accessToken)
  })

  it('códigos diferentes geram hashes diferentes', async () => {
    const a = await deriveRoomKeys(generateInviteSecret().bytes)
    const b = await deriveRoomKeys(generateInviteSecret().bytes)
    expect(a.accessHash).not.toBe(b.accessHash)
  })

  it('confere com uma implementação independente de HKDF + SHA-256', async () => {
    const secret = randomBytes(15)
    const keys = await deriveRoomKeys(secret)
    const expectedToken = new Uint8Array(
      hkdfSync('sha256', secret, utf8Encode('mensageiro-privado/hkdf-salt/v1'), utf8Encode('mp/access/v1'), 32),
    )
    expect(keys.accessToken).toEqual(expectedToken)
    expect(keys.accessHash).toBe(createHash('sha256').update(expectedToken).digest('hex'))
  })

  it('a chave da sala não é exportável', async () => {
    const { roomKey } = await deriveRoomKeys(generateInviteSecret().bytes)
    expect(roomKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', roomKey)).rejects.toThrow()
  })

  it('o token que o servidor recebe não decifra o conteúdo', async () => {
    const { accessToken, roomKey } = await deriveRoomKeys(generateInviteSecret().bytes)
    const iv = randomBytes(12)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, roomKey, utf8Encode('segredo'))
    const serverGuess = await crypto.subtle.importKey('raw', accessToken, 'AES-GCM', false, ['decrypt'])
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, serverGuess, ct)).rejects.toThrow()
  })
})
