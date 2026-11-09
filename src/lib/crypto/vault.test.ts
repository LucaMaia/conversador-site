// @vitest-environment node
import { generateInviteSecret } from './inviteCode.ts'
import { deriveRoomKeys } from './keys.ts'
import {
  createVault,
  decryptInviteCode,
  encryptInviteCode,
  unlockVault,
  VAULT_KDF_ITERATIONS,
} from './vault.ts'

const USER = '00000000-0000-4000-8000-00000000000a'
const PASS = 'uma frase longa do cofre'

describe('cofre do admin', { timeout: 30_000 }, () => {
  it('cria e desbloqueia com a frase correta', async () => {
    const { record, masterKey } = await createVault(USER, PASS)
    expect(record.kdf_iterations).toBe(VAULT_KDF_ITERATIONS)
    expect(record.wrap_iv).toMatch(/^[A-Za-z0-9+/]{16}$/)
    expect(masterKey.extractable).toBe(false)
    const unlocked = await unlockVault(USER, PASS, record)
    expect(unlocked.extractable).toBe(false)
  })

  it('recusa frase errada ou cofre de outro usuário', async () => {
    const { record } = await createVault(USER, PASS)
    await expect(unlockVault(USER, 'frase errada do cofre', record)).rejects.toMatchObject({
      code: 'wrong_passphrase',
    })
    await expect(unlockVault('00000000-0000-4000-8000-00000000000b', PASS, record)).rejects.toMatchObject({
      code: 'wrong_passphrase',
    })
  })

  it('recusa frase curta e parâmetros enfraquecidos', async () => {
    await expect(createVault(USER, 'curta')).rejects.toMatchObject({ code: 'weak_passphrase' })
    const { record } = await createVault(USER, PASS)
    await expect(unlockVault(USER, PASS, { ...record, kdf_iterations: 1000 })).rejects.toMatchObject({
      code: 'invalid_payload',
    })
  })

  it('guarda e recupera o código de convite de uma sala', async () => {
    const { record } = await createVault(USER, PASS)
    const masterKey = await unlockVault(USER, PASS, record)
    const invite = generateInviteSecret()
    const { accessHash } = await deriveRoomKeys(invite.bytes)

    const enc = await encryptInviteCode(masterKey, accessHash, invite.code)
    expect(enc.admin_code_ct).not.toContain(invite.code)
    expect(await decryptInviteCode(masterKey, accessHash, enc)).toBe(invite.code)
  })

  it('não aceita código cifrado trocado entre salas', async () => {
    const { masterKey } = await createVault(USER, PASS)
    const a = generateInviteSecret()
    const b = generateInviteSecret()
    const hashA = (await deriveRoomKeys(a.bytes)).accessHash
    const hashB = (await deriveRoomKeys(b.bytes)).accessHash
    const encA = await encryptInviteCode(masterKey, hashA, a.code)
    await expect(decryptInviteCode(masterKey, hashB, encA)).rejects.toMatchObject({ code: 'decrypt_failed' })

    // Mesmo com o AAD correto, o código precisa derivar o hash da sala.
    const forged = await encryptInviteCode(masterKey, hashA, b.code)
    await expect(decryptInviteCode(masterKey, hashA, forged)).rejects.toMatchObject({ code: 'decrypt_failed' })
  })
})
