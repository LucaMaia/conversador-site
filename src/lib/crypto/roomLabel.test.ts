// @vitest-environment node
import { generateInviteSecret } from './inviteCode.ts'
import { deriveRoomKeys } from './keys.ts'
import {
  createVault,
  decryptRoomLabel,
  encryptRoomLabel,
  MAX_ROOM_LABEL_LENGTH,
  normalizeRoomLabel,
} from './vault.ts'

const USER = '00000000-0000-4000-8000-00000000000a'

describe('nome da conversa', { timeout: 30_000 }, () => {
  it('cifra e decifra com a master key', async () => {
    const { masterKey } = await createVault(USER, 'uma frase longa do cofre')
    const { accessHash } = await deriveRoomKeys(generateInviteSecret().bytes)
    const enc = await encryptRoomLabel(masterKey, accessHash, 'João — trabalho')
    expect(atob(enc.admin_label_ct)).not.toContain('Jo')
    expect(await decryptRoomLabel(masterKey, accessHash, enc)).toBe('João — trabalho')
  })

  it('não aceita o nome de outra sala nem outra master key', async () => {
    const { masterKey } = await createVault(USER, 'uma frase longa do cofre')
    const { masterKey: otherKey } = await createVault(USER, 'outra frase longa do cofre')
    const a = (await deriveRoomKeys(generateInviteSecret().bytes)).accessHash
    const b = (await deriveRoomKeys(generateInviteSecret().bytes)).accessHash
    const enc = await encryptRoomLabel(masterKey, a, 'Maria')
    await expect(decryptRoomLabel(masterKey, b, enc)).rejects.toMatchObject({ code: 'decrypt_failed' })
    await expect(decryptRoomLabel(otherKey, a, enc)).rejects.toMatchObject({ code: 'decrypt_failed' })
  })

  it('normaliza espaços, vazio e tamanho máximo', () => {
    expect(normalizeRoomLabel('  Ana   Paula ')).toBe('Ana Paula')
    expect(normalizeRoomLabel('   ')).toBeNull()
    expect(normalizeRoomLabel('x'.repeat(100))).toHaveLength(MAX_ROOM_LABEL_LENGTH)
  })
})
