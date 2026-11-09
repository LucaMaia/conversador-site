// Cifra de arquivos (imagens, vídeos, áudios) em blocos.
//
// Formato:  "MPF1" | chunkSize (u32 BE) | bloco_0 | bloco_1 | ... | bloco_n
// Bloco:    iv (12 bytes) | AES-256-GCM(dados) (+16 bytes de tag)
// AAD:      "mp/file/v1|<roomId>|<fileId>|<chunkSize>|<índice>|<final 0/1>"
//
// O índice no AAD impede reordenar blocos; a marca "final" impede truncar
// o arquivo (o último bloco restante não foi cifrado como final).
// Arquivos vazios geram um único bloco final vazio.
import { type Bytes, concatBytes, randomBytes, utf8Encode } from './encoding.ts'
import { CryptoError } from './errors.ts'

export const FILE_CHUNK_SIZE = 1024 * 1024
/** Limite do bucket (50 MiB) menos a sobrecarga de cifra. */
export const MAX_FILE_BYTES = 49 * 1024 * 1024

const MAGIC = utf8Encode('MPF1')
const HEADER_BYTES = MAGIC.length + 4
const IV_BYTES = 12
const TAG_BYTES = 16

function chunkAad(roomId: string, fileId: string, chunkSize: number, index: number, final: boolean) {
  return utf8Encode(`mp/file/v1|${roomId}|${fileId}|${chunkSize}|${index}|${final ? 1 : 0}`)
}

function encodeHeader(chunkSize: number): Bytes {
  const header = new Uint8Array(HEADER_BYTES)
  header.set(MAGIC, 0)
  new DataView(header.buffer).setUint32(MAGIC.length, chunkSize, false)
  return header
}

async function readBytes(blob: Blob, start: number, end: number): Promise<Bytes> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer())
}

export async function encryptFile(
  roomKey: CryptoKey,
  roomId: string,
  fileId: string,
  file: Blob,
  chunkSize: number = FILE_CHUNK_SIZE,
): Promise<Blob> {
  if (file.size > MAX_FILE_BYTES) {
    throw new CryptoError('file_too_large', 'Arquivo acima do limite de 49 MB')
  }

  const parts: BlobPart[] = [encodeHeader(chunkSize)]
  const chunkCount = Math.max(1, Math.ceil(file.size / chunkSize))

  for (let index = 0; index < chunkCount; index++) {
    const final = index === chunkCount - 1
    const plain = await readBytes(file, index * chunkSize, (index + 1) * chunkSize)
    const iv = randomBytes(IV_BYTES)
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: chunkAad(roomId, fileId, chunkSize, index, final) },
      roomKey,
      plain,
    )
    parts.push(concatBytes(iv, new Uint8Array(ct)))
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

export async function decryptFile(
  roomKey: CryptoKey,
  roomId: string,
  fileId: string,
  encrypted: Blob,
  mime: string,
): Promise<Blob> {
  if (encrypted.size < HEADER_BYTES + IV_BYTES + TAG_BYTES) {
    throw new CryptoError('malformed_file', 'Arquivo cifrado inválido')
  }

  const header = await readBytes(encrypted, 0, HEADER_BYTES)
  for (let i = 0; i < MAGIC.length; i++) {
    if (header[i] !== MAGIC[i]) throw new CryptoError('malformed_file', 'Arquivo cifrado inválido')
  }
  const chunkSize = new DataView(header.buffer).getUint32(MAGIC.length, false)
  if (chunkSize === 0 || chunkSize > 16 * 1024 * 1024) {
    throw new CryptoError('malformed_file', 'Arquivo cifrado inválido')
  }

  const fullChunk = IV_BYTES + chunkSize + TAG_BYTES
  const parts: BlobPart[] = []
  let offset = HEADER_BYTES
  let index = 0

  while (offset < encrypted.size) {
    const remaining = encrypted.size - offset
    const final = remaining <= fullChunk
    const length = final ? remaining : fullChunk
    if (length < IV_BYTES + TAG_BYTES) {
      throw new CryptoError('malformed_file', 'Arquivo cifrado inválido')
    }

    const block = await readBytes(encrypted, offset, offset + length)
    try {
      const plain = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: block.subarray(0, IV_BYTES),
          additionalData: chunkAad(roomId, fileId, chunkSize, index, final),
        },
        roomKey,
        block.subarray(IV_BYTES),
      )
      parts.push(new Uint8Array(plain))
    } catch {
      throw new CryptoError('decrypt_failed', 'Arquivo corrompido ou adulterado')
    }

    offset += length
    index++
  }

  return new Blob(parts, { type: mime })
}
