import type { MediaPayload } from '../domain/messagePayload.ts'
import { decryptFile, encryptFile } from '../lib/crypto/index.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

const BUCKET = 'attachments'
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85
const MAX_INPUT_BYTES = 40 * 1024 * 1024

export interface PreparedImage {
  readonly blob: Blob
  readonly width: number
  readonly height: number
}

/**
 * Redesenha a imagem num canvas e exporta JPEG. Isso:
 *  - remove metadados (EXIF: localização GPS, modelo do aparelho, data);
 *  - aplica a orientação correta;
 *  - reduz para no máximo 2048 px no maior lado.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new ServiceError('Selecione uma imagem.')
  if (file.size > MAX_INPUT_BYTES) throw new ServiceError('Imagem muito grande (máximo 40 MB).')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ServiceError('Formato de imagem não suportado neste navegador.')
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ServiceError('Não foi possível processar a imagem.')
  ctx.fillStyle = '#ffffff' // fundo para imagens com transparência
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new ServiceError('Não foi possível processar a imagem.')
  return { blob, width, height }
}

export function attachmentPathFor(roomId: string, fileId: string): string {
  return `${roomId}/${fileId}`
}

/** Cifra no navegador e envia. O Storage recebe só bytes cifrados. */
export async function uploadEncryptedFile(roomId: string, roomKey: CryptoKey, fileId: string, file: Blob): Promise<string> {
  const encrypted = await encryptFile(roomKey, roomId, fileId, file)
  const path = attachmentPathFor(roomId, fileId)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, encrypted, { contentType: 'application/octet-stream', upsert: false, cacheControl: 'no-store' })
  if (error) throw new ServiceError('Falha ao enviar a imagem.', { cause: error })
  return path
}

/**
 * Registra a abertura no servidor. Para o destinatário, a primeira chamada
 * inicia os 15 minutos. Retorna o fim do acesso (null = ainda sem prazo).
 */
export async function markMediaViewed(messageId: string): Promise<Date | null> {
  const { data, error } = await supabase.rpc('mark_media_viewed', { p_message_id: messageId })
  if (error) throw new ServiceError('Imagem indisponível.', { cause: error })
  return data ? new Date(data) : null
}

/** Baixa e decifra. O resultado fica só em memória (Blob), nunca em disco. */
export async function downloadMedia(roomId: string, roomKey: CryptoKey, payload: MediaPayload): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(attachmentPathFor(roomId, payload.fileId))
  if (error || !data) throw new ServiceError('Imagem indisponível ou expirada.', { cause: error })
  try {
    return await decryptFile(roomKey, roomId, payload.fileId, data, payload.mime)
  } catch (err) {
    throw new ServiceError('Não foi possível decifrar a imagem.', { cause: err })
  }
}
