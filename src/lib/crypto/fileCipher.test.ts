// @vitest-environment node
import { randomBytes } from './encoding.ts'
import { decryptFile, encryptFile, MAX_FILE_BYTES } from './fileCipher.ts'
import { generateInviteSecret } from './inviteCode.ts'
import { deriveRoomKeys } from './keys.ts'

const ROOM = '11111111-1111-4111-8111-111111111111'
const FILE = '44444444-4444-4444-8444-444444444444'
const CHUNK = 16
const BLOCK = 12 + CHUNK + 16
const HEADER = 8

async function roomKey() {
  return (await deriveRoomKeys(generateInviteSecret().bytes)).roomKey
}

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

describe('cifra de arquivos', () => {
  it.each([0, 1, 15, 16, 17, 32, 100])('ida e volta com %i bytes', async (size) => {
    const key = await roomKey()
    const data = randomBytes(size)
    const enc = await encryptFile(key, ROOM, FILE, new Blob([data]), CHUNK)
    expect(enc.type).toBe('application/octet-stream')
    const dec = await decryptFile(key, ROOM, FILE, enc, 'image/png')
    expect(dec.type).toBe('image/png')
    expect(await bytesOf(dec)).toEqual(data)
  })

  it('funciona com o tamanho de bloco padrão', async () => {
    const key = await roomKey()
    const data = randomBytes(2.5 * 1024 * 1024)
    const enc = await encryptFile(key, ROOM, FILE, new Blob([data]))
    expect(await bytesOf(await decryptFile(key, ROOM, FILE, enc, 'video/mp4'))).toEqual(data)
  })

  it('detecta arquivo truncado (bloco final removido)', async () => {
    const key = await roomKey()
    const enc = await bytesOf(await encryptFile(key, ROOM, FILE, new Blob([randomBytes(40)]), CHUNK))
    const truncated = new Blob([enc.subarray(0, HEADER + 2 * BLOCK)])
    await expect(decryptFile(key, ROOM, FILE, truncated, 'image/png')).rejects.toMatchObject({
      code: 'decrypt_failed',
    })
  })

  it('detecta blocos reordenados', async () => {
    const key = await roomKey()
    const enc = await bytesOf(await encryptFile(key, ROOM, FILE, new Blob([randomBytes(40)]), CHUNK))
    const b0 = enc.subarray(HEADER, HEADER + BLOCK)
    const b1 = enc.subarray(HEADER + BLOCK, HEADER + 2 * BLOCK)
    const rest = enc.subarray(HEADER + 2 * BLOCK)
    const swapped = new Blob([enc.subarray(0, HEADER), b1, b0, rest])
    await expect(decryptFile(key, ROOM, FILE, swapped, 'image/png')).rejects.toMatchObject({
      code: 'decrypt_failed',
    })
  })

  it('falha com outro fileId, outra sala ou outra chave', async () => {
    const key = await roomKey()
    const enc = await encryptFile(key, ROOM, FILE, new Blob([randomBytes(20)]), CHUNK)
    await expect(decryptFile(key, ROOM, '55555555-5555-4555-8555-555555555555', enc, 'x/y')).rejects.toThrow()
    await expect(decryptFile(key, '22222222-2222-4222-8222-222222222222', FILE, enc, 'x/y')).rejects.toThrow()
    await expect(decryptFile(await roomKey(), ROOM, FILE, enc, 'x/y')).rejects.toThrow()
  })

  it('rejeita arquivos sem o cabeçalho correto', async () => {
    const key = await roomKey()
    await expect(decryptFile(key, ROOM, FILE, new Blob([randomBytes(100)]), 'x/y')).rejects.toMatchObject({
      code: 'malformed_file',
    })
  })

  it('recusa arquivos acima do limite antes de cifrar', async () => {
    const key = await roomKey()
    const huge = { size: MAX_FILE_BYTES + 1 } as Blob
    await expect(encryptFile(key, ROOM, FILE, huge)).rejects.toMatchObject({ code: 'file_too_large' })
  })
})
