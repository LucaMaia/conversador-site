// @vitest-environment node
import type { MessagePayload } from '../../domain/messagePayload.ts'
import { fromBase64, randomBytes, toBase64, utf8Encode } from './encoding.ts'
import { CryptoError } from './errors.ts'
import { generateInviteSecret } from './inviteCode.ts'
import { deriveRoomKeys } from './keys.ts'
import { decryptMessage, encryptMessage } from './messageCipher.ts'

const ROOM = '11111111-1111-4111-8111-111111111111'
const OTHER_ROOM = '22222222-2222-4222-8222-222222222222'
const MSG = '33333333-3333-4333-8333-333333333333'

async function roomKey() {
  return (await deriveRoomKeys(generateInviteSecret().bytes)).roomKey
}

const text: MessagePayload = { v: 1, kind: 'text', text: 'Olá, tudo bem? 🔒' }

describe('cifra de mensagens', () => {
  it('ida e volta de texto e mídia', async () => {
    const key = await roomKey()
    const media: MessagePayload = {
      v: 1,
      kind: 'image',
      mime: 'image/jpeg',
      size: 12345,
      fileId: '44444444-4444-4444-8444-444444444444',
      width: 800,
      height: 600,
      thumbnail: toBase64(randomBytes(50)),
    }
    for (const payload of [text, media]) {
      const enc = await encryptMessage(key, ROOM, MSG, payload)
      expect(await decryptMessage(key, ROOM, MSG, enc)).toEqual(payload)
    }
  })

  it('o ciphertext não contém o texto e o IV muda a cada envio', async () => {
    const key = await roomKey()
    const a = await encryptMessage(key, ROOM, MSG, text)
    const b = await encryptMessage(key, ROOM, MSG, text)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
    expect(atob(a.ciphertext)).not.toContain('Olá')
    expect(a.iv).toMatch(/^[A-Za-z0-9+/]{16}$/)
  })

  it('falha com a chave de outra sala', async () => {
    const enc = await encryptMessage(await roomKey(), ROOM, MSG, text)
    await expect(decryptMessage(await roomKey(), ROOM, MSG, enc)).rejects.toMatchObject({ code: 'decrypt_failed' })
  })

  it('falha se o servidor mover a mensagem para outra sala ou trocar o id', async () => {
    const key = await roomKey()
    const enc = await encryptMessage(key, ROOM, MSG, text)
    await expect(decryptMessage(key, OTHER_ROOM, MSG, enc)).rejects.toBeInstanceOf(CryptoError)
    await expect(
      decryptMessage(key, ROOM, '55555555-5555-4555-8555-555555555555', enc),
    ).rejects.toBeInstanceOf(CryptoError)
  })

  it('detecta adulteração do ciphertext', async () => {
    const key = await roomKey()
    const enc = await encryptMessage(key, ROOM, MSG, text)
    const bytes = fromBase64(enc.ciphertext)
    bytes[0] = (bytes[0] ?? 0) ^ 1
    await expect(
      decryptMessage(key, ROOM, MSG, { ...enc, ciphertext: toBase64(bytes) }),
    ).rejects.toMatchObject({ code: 'decrypt_failed' })
  })

  it('rejeita conteúdo malformado mesmo quando decifrado corretamente', async () => {
    const key = await roomKey()
    const iv = randomBytes(12)
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: utf8Encode(`mp/msg/v1|${ROOM}|${MSG}`) },
      key,
      utf8Encode(JSON.stringify({ v: 1, kind: 'image', mime: 'text/html', size: 1, fileId: 'x' })),
    )
    await expect(
      decryptMessage(key, ROOM, MSG, { ciphertext: toBase64(new Uint8Array(ct)), iv: toBase64(iv) }),
    ).rejects.toMatchObject({ code: 'invalid_payload' })
  })
})
