// Cofre do administrador.
//
//   vaultKey  = PBKDF2-SHA256(frase do cofre, salt, 600.000 iterações)
//   masterKey = AES-256-GCM aleatória, guardada cifrada (wrapKey) pela vaultKey
//
// A frase do cofre é diferente da senha de login e nunca sai do navegador.
// A masterKey cifra os códigos de convite, para que o admin possa copiá-los
// depois sem que o servidor conheça os códigos (e portanto as chaves das salas).
import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from './encoding.ts'
import { CryptoError } from './errors.ts'
import { deriveRoomKeys } from './keys.ts'
import { parseInviteCode } from './inviteCode.ts'

export const VAULT_KDF_ITERATIONS = 600_000
export const MIN_PASSPHRASE_LENGTH = 12

/** Exatamente como armazenado em public.admin_vault. */
export interface VaultRecord {
  readonly kdf_salt: string
  readonly kdf_iterations: number
  readonly wrapped_master_key: string
  readonly wrap_iv: string
}

export interface EncryptedInviteCode {
  readonly admin_code_ct: string
  readonly admin_code_iv: string
}

function vaultAad(userId: string) {
  return utf8Encode(`mp/vault/v1|${userId}`)
}

function inviteAad(accessHash: string) {
  return utf8Encode(`mp/invite/v1|${accessHash}`)
}

async function deriveVaultKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', utf8Encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export function assertPassphraseStrength(passphrase: string): void {
  if (passphrase.normalize('NFKC').length < MIN_PASSPHRASE_LENGTH) {
    throw new CryptoError(
      'weak_passphrase',
      `A frase do cofre precisa ter pelo menos ${MIN_PASSPHRASE_LENGTH} caracteres`,
    )
  }
}

export async function createVault(
  userId: string,
  passphrase: string,
): Promise<{ record: VaultRecord; masterKey: CryptoKey }> {
  assertPassphraseStrength(passphrase)

  const salt = randomBytes(16)
  const vaultKey = await deriveVaultKey(passphrase, salt, VAULT_KDF_ITERATIONS)

  // Gerada extraível apenas para poder ser embrulhada; a cópia em uso
  // é reimportada como não extraível.
  const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const iv = randomBytes(12)
  const wrapped = await crypto.subtle.wrapKey('raw', generated, vaultKey, {
    name: 'AES-GCM',
    iv,
    additionalData: vaultAad(userId),
  })

  const record: VaultRecord = {
    kdf_salt: toBase64(salt),
    kdf_iterations: VAULT_KDF_ITERATIONS,
    wrapped_master_key: toBase64(new Uint8Array(wrapped)),
    wrap_iv: toBase64(iv),
  }
  return { record, masterKey: await unlockVault(userId, passphrase, record) }
}

export async function unlockVault(userId: string, passphrase: string, record: VaultRecord): Promise<CryptoKey> {
  if (record.kdf_iterations < VAULT_KDF_ITERATIONS) {
    throw new CryptoError('invalid_payload', 'Parâmetros do cofre inseguros')
  }
  const vaultKey = await deriveVaultKey(passphrase, fromBase64(record.kdf_salt), record.kdf_iterations)
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      fromBase64(record.wrapped_master_key),
      vaultKey,
      { name: 'AES-GCM', iv: fromBase64(record.wrap_iv), additionalData: vaultAad(userId) },
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  } catch {
    throw new CryptoError('wrong_passphrase', 'Frase do cofre incorreta')
  }
}

export async function encryptInviteCode(
  masterKey: CryptoKey,
  accessHash: string,
  code: string,
): Promise<EncryptedInviteCode> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: inviteAad(accessHash) },
    masterKey,
    utf8Encode(code),
  )
  return { admin_code_ct: toBase64(new Uint8Array(ct)), admin_code_iv: toBase64(iv) }
}

/**
 * Decifra o código guardado e confere que ele realmente corresponde à sala
 * (o hash derivado precisa bater com rooms.access_hash).
 */
export async function decryptInviteCode(
  masterKey: CryptoKey,
  accessHash: string,
  encrypted: EncryptedInviteCode,
): Promise<string> {
  let code: string
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(encrypted.admin_code_iv), additionalData: inviteAad(accessHash) },
      masterKey,
      fromBase64(encrypted.admin_code_ct),
    )
    code = utf8Decode(new Uint8Array(plain))
  } catch {
    throw new CryptoError('decrypt_failed', 'Não foi possível decifrar o código da sala')
  }

  const secret = parseInviteCode(code)
  const keys = await deriveRoomKeys(secret.bytes)
  if (keys.accessHash !== accessHash) {
    throw new CryptoError('decrypt_failed', 'Código não corresponde à sala')
  }
  return secret.code
}
