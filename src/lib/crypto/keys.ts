// Derivação de chaves a partir do segredo do convite (HKDF-SHA256).
//
//   accessToken = HKDF(S, info="mp/access/v1")  → enviado ao servidor
//   accessHash  = SHA-256(accessToken) em hex   → único valor guardado no banco
//   roomKey     = HKDF(S, info="mp/room/v1")    → AES-256-GCM, não exportável
//
// Como as saídas do HKDF com "info" diferentes são independentes, conhecer
// o accessToken (servidor) não permite obter a roomKey.
import { type Bytes, concatBytes, toHex, utf8Encode } from './encoding.ts'

const HKDF_SALT = utf8Encode('mensageiro-privado/hkdf-salt/v1')
const INFO_ACCESS = utf8Encode('mp/access/v1')
const INFO_ROOM = utf8Encode('mp/room/v1')

export interface RoomKeys {
  /** Enviado à Edge Function join-room. */
  readonly accessToken: Bytes
  /** SHA-256 hex do accessToken, como gravado em rooms.access_hash. */
  readonly accessHash: string
  /** Chave AES-GCM da sala. Não exportável. */
  readonly roomKey: CryptoKey
}

async function importSecret(secret: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits', 'deriveKey'])
}

export async function sha256Hex(data: Bytes): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(digest))
}

export async function deriveRoomKeys(secret: Bytes): Promise<RoomKeys> {
  const base = await importSecret(secret)

  const accessBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: INFO_ACCESS },
    base,
    256,
  )
  const accessToken = concatBytes(new Uint8Array(accessBits))

  const roomKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: INFO_ROOM },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  return { accessToken, accessHash: await sha256Hex(accessToken), roomKey }
}
