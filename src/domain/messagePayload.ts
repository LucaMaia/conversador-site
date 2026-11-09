// Conteúdo de uma mensagem ANTES da cifra. Tudo aqui fica dentro do
// ciphertext: o servidor não sabe nem o tipo da mensagem.

export const MAX_TEXT_LENGTH = 10_000
export const MAX_THUMBNAIL_BASE64 = 120_000

export type MediaKind = 'image' | 'video' | 'audio'

export interface TextPayload {
  readonly v: 1
  readonly kind: 'text'
  readonly text: string
}

export interface MediaPayload {
  readonly v: 1
  readonly kind: MediaKind
  /** MIME real do arquivo (o objeto no Storage é sempre octet-stream). */
  readonly mime: string
  /** Tamanho do arquivo original em bytes. */
  readonly size: number
  /** Identificador do arquivo, também usado no AAD da cifra do arquivo. */
  readonly fileId: string
  readonly name?: string
  readonly width?: number
  readonly height?: number
  readonly durationMs?: number
  /** Miniatura JPEG em base64 (imagens e vídeos). */
  readonly thumbnail?: string
  readonly caption?: string
}

export type MessagePayload = TextPayload | MediaPayload

const MIME_PREFIX: Record<MediaKind, string> = {
  image: 'image/',
  video: 'video/',
  audio: 'audio/',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalPositiveInt(value: unknown): boolean {
  return value === undefined || (Number.isInteger(value) && (value as number) >= 0)
}

function optionalString(value: unknown, max: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= max)
}

/**
 * Valida um payload vindo de fora (decifrado de outra pessoa).
 * Uma chave compartilhada não impede o outro participante de enviar
 * conteúdo malformado, então nada é confiado sem validação.
 */
export function parseMessagePayload(value: unknown): MessagePayload | null {
  if (!isRecord(value) || value.v !== 1) return null

  if (value.kind === 'text') {
    if (typeof value.text !== 'string' || value.text.length === 0) return null
    if (value.text.length > MAX_TEXT_LENGTH) return null
    return { v: 1, kind: 'text', text: value.text }
  }

  if (value.kind === 'image' || value.kind === 'video' || value.kind === 'audio') {
    const kind: MediaKind = value.kind
    const { mime, size, fileId } = value
    if (typeof mime !== 'string' || !mime.startsWith(MIME_PREFIX[kind]) || mime.length > 100) return null
    if (!Number.isInteger(size) || (size as number) < 0) return null
    if (typeof fileId !== 'string' || !UUID_RE.test(fileId)) return null
    if (!optionalString(value.name, 255)) return null
    if (!optionalString(value.caption, MAX_TEXT_LENGTH)) return null
    if (!optionalString(value.thumbnail, MAX_THUMBNAIL_BASE64)) return null
    if (!optionalPositiveInt(value.width) || !optionalPositiveInt(value.height)) return null
    if (!optionalPositiveInt(value.durationMs)) return null

    const payload: MediaPayload = {
      v: 1,
      kind,
      mime,
      size: size as number,
      fileId,
      ...(typeof value.name === 'string' && { name: value.name }),
      ...(typeof value.caption === 'string' && { caption: value.caption }),
      ...(typeof value.thumbnail === 'string' && { thumbnail: value.thumbnail }),
      ...(typeof value.width === 'number' && { width: value.width }),
      ...(typeof value.height === 'number' && { height: value.height }),
      ...(typeof value.durationMs === 'number' && { durationMs: value.durationMs }),
    }
    return payload
  }

  return null
}
