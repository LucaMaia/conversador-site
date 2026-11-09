/** Contêineres ISO BMFF (MP4/MOV), dos quais removemos metadados. */
const ISO_BMFF_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp'])

export function isIsoBmffVideo(mime: string): boolean {
  return ISO_BMFF_TYPES.has(mime.toLowerCase())
}

/**
 * Tipo usado para reproduzir. Vídeos .mov do iPhone (video/quicktime) usam os
 * mesmos codecs de um MP4; declarar video/mp4 permite tocá-los no Chrome e no
 * Android, que recusam "video/quicktime".
 */
export function playbackMime(mime: string): string {
  const lower = mime.toLowerCase()
  return lower === 'video/quicktime' || lower === 'video/x-m4v' ? 'video/mp4' : lower
}

/** "48,3 MB" */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
