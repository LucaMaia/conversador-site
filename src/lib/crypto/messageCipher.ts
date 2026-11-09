// Cifra de mensagens: AES-256-GCM, IV aleatório de 96 bits por mensagem.
// AAD = "mp/msg/v1|<roomId>|<messageId>": impede que um ciphertext seja
// reaproveitado em outra sala ou trocado de identificador sem detecção.
import { parseMessagePayload, type MessagePayload } from '../../domain/messagePayload.ts'
import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from './encoding.ts'
import { CryptoError } from './errors.ts'

export interface EncryptedMessage {
  readonly ciphertext: string
  readonly iv: string
}

function messageAad(roomId: string, messageId: string) {
  return utf8Encode(`mp/msg/v1|${roomId}|${messageId}`)
}

export async function encryptMessage(
  roomKey: CryptoKey,
  roomId: string,
  messageId: string,
  payload: MessagePayload,
): Promise<EncryptedMessage> {
  const iv = randomBytes(12)
  const plaintext = utf8Encode(JSON.stringify(payload))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: messageAad(roomId, messageId) },
    roomKey,
    plaintext,
  )
  return { ciphertext: toBase64(new Uint8Array(ct)), iv: toBase64(iv) }
}

export async function decryptMessage(
  roomKey: CryptoKey,
  roomId: string,
  messageId: string,
  encrypted: EncryptedMessage,
): Promise<MessagePayload> {
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(encrypted.iv),
        additionalData: messageAad(roomId, messageId),
      },
      roomKey,
      fromBase64(encrypted.ciphertext),
    )
  } catch {
    throw new CryptoError('decrypt_failed', 'Não foi possível decifrar a mensagem')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(utf8Decode(new Uint8Array(plaintext)))
  } catch {
    throw new CryptoError('invalid_payload', 'Conteúdo da mensagem inválido')
  }
  const payload = parseMessagePayload(parsed)
  if (!payload) throw new CryptoError('invalid_payload', 'Conteúdo da mensagem inválido')
  return payload
}
