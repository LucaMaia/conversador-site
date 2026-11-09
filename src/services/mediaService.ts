import type { MediaPayload } from '../domain/messagePayload.ts'
import { formatMegabytes, isIsoBmffVideo, playbackMime } from '../domain/video.ts'
import { decryptFile, encryptFile, MAX_FILE_BYTES } from '../lib/crypto/index.ts'
import { scrubMp4Metadata } from '../lib/mp4Metadata.ts'
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

export interface PreparedVideo {
  readonly blob: Blob
  readonly mime: string
  readonly width?: number
  readonly height?: number
  readonly durationMs?: number
}

interface VideoInfo {
  width?: number
  height?: number
  durationMs?: number
}

/** Lê duração e dimensões sem enviar nada (falha silenciosa: são opcionais). */
function readVideoInfo(file: Blob): Promise<VideoInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (info: VideoInfo) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(info)
    }
    const timer = setTimeout(() => done({}), 5000)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () =>
      done({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined,
      })
    video.onerror = () => done({})
    video.src = url
  })
}

/**
 * Prepara o vídeo para envio:
 *  - limita o tamanho (o arquivo cifrado precisa caber no bucket);
 *  - remove metadados de MP4/MOV (localização GPS, aparelho), sem recodificar.
 */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (!file.type.startsWith('video/')) throw new ServiceError('Selecione um vídeo.')
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError(
      `Vídeo muito grande (${formatMegabytes(file.size)}). O limite é ${formatMegabytes(MAX_FILE_BYTES)}; grave um trecho menor.`,
    )
  }

  const mime = file.type.toLowerCase()
  const info = await readVideoInfo(file)
  let blob: Blob = file
  if (isIsoBmffVideo(mime)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    scrubMp4Metadata(bytes)
    blob = new Blob([bytes], { type: mime })
  }
  return { blob, mime, ...info }
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
    // Vídeos .mov são reproduzidos como MP4 (mesmos codecs).
    const type = payload.kind === 'video' ? playbackMime(payload.mime) : payload.mime
    return await decryptFile(roomKey, roomId, payload.fileId, data, type)
  } catch (err) {
    throw new ServiceError('Não foi possível decifrar a imagem.', { cause: err })
  }
}
