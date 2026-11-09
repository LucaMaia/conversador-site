/** Duração máxima de uma gravação. */
export const MAX_AUDIO_MS = 5 * 60 * 1000

/**
 * Formatos em ordem de preferência. MP4/AAC toca em todos os navegadores
 * atuais (inclusive Safari/iOS); WebM/Opus é o padrão do Chrome/Firefox antigos.
 */
const PREFERRED_AUDIO_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const

export function pickAudioMimeType(isSupported: (type: string) => boolean): string | null {
  return PREFERRED_AUDIO_TYPES.find((type) => isSupported(type)) ?? null
}

/** "audio/webm;codecs=opus" → "audio/webm" (tipo usado para reproduzir). */
export function baseMimeType(type: string): string {
  return type.split(';')[0]?.trim().toLowerCase() ?? type
}

/** "0:07", "1:05", "12:30". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
