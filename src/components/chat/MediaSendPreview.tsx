import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { formatMegabytes } from '../../domain/video.ts'
import { MAX_FILE_BYTES } from '../../lib/crypto/index.ts'
import { Button } from '../ui/Button.tsx'

interface MediaSendPreviewProps {
  file: File
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmação antes do envio. A pré-visualização é local: nada foi enviado ainda. */
export function MediaSendPreview({ file, onCancel, onConfirm }: MediaSendPreviewProps) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const isVideo = file.type.startsWith('video/')
  const tooLarge = isVideo && file.size > MAX_FILE_BYTES

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Enviar vídeo' : 'Enviar foto'}
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 animate-[fade-in_150ms_ease-out]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {isVideo ? (
          <video src={url} controls playsInline muted className="max-h-full max-w-full rounded-lg bg-black" />
        ) : (
          <img src={url} alt="Pré-visualização" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-ink-800 bg-ink-900 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {tooLarge ? (
          <p role="alert" className="text-center text-xs text-danger-500">
            Vídeo muito grande ({formatMegabytes(file.size)}). O limite é {formatMegabytes(MAX_FILE_BYTES)}; grave ou
            selecione um trecho menor.
          </p>
        ) : (
          <p className="text-center text-xs text-ink-400">
            {isVideo ? 'O vídeo' : 'A foto'} é cifrad{isVideo ? 'o' : 'a'} neste aparelho, sem localização nem dados
            do aparelho, e some 15 minutos depois de abert{isVideo ? 'o' : 'a'}.
            {isVideo && ` Tamanho: ${formatMegabytes(file.size)}.`}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={tooLarge}>
            {isVideo ? 'Enviar vídeo' : 'Enviar foto'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
