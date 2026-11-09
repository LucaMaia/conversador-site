import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button.tsx'

interface ImageSendPreviewProps {
  file: File
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmação antes do envio. A pré-visualização é local, nada foi enviado ainda. */
export function ImageSendPreview({ file, onCancel, onConfirm }: ImageSendPreviewProps) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Enviar imagem" className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 animate-[fade-in_150ms_ease-out]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <img src={url} alt="Pré-visualização" className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      <div className="flex flex-col gap-3 border-t border-ink-800 bg-ink-900 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-xs text-ink-400">
          A foto é cifrada neste aparelho, sem localização nem dados da câmera. Ela some 15 minutos depois de aberta.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            Enviar foto
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
