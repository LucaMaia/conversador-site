import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMinutes } from '../../domain/ephemeralMedia.ts'

interface ImageViewerProps {
  url: string
  /** Fim do acesso; null = sem contagem (ex.: remetente antes da abertura). */
  expiresAt: Date | null
  onClose: () => void
}

/** Visualização em tela cheia. Fecha sozinha quando o prazo termina. */
export function ImageViewer({ url, expiresAt, onClose }: ImageViewerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const remaining = expiresAt ? expiresAt.getTime() - now : null
  useEffect(() => {
    if (remaining !== null && remaining <= 0) onClose()
  }, [remaining, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-[fade-in_150ms_ease-out]"
    >
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-mono text-sm tabular-nums text-ink-200">
          {remaining !== null ? `some em ${formatMinutes(remaining)}` : ''}
        </span>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-sm text-ink-200 hover:bg-white/10">
          Fechar
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <img
          src={url}
          alt=""
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-full max-w-full object-contain select-none"
        />
      </div>
    </div>,
    document.body,
  )
}
