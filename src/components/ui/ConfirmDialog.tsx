import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button.tsx'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação para ações destrutivas. No celular, aparece como painel inferior. */
export function ConfirmDialog({ title, children, confirmLabel, busy, error, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 animate-[fade-in_150ms_ease-out] sm:items-center"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl border border-ink-800 bg-ink-900 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-ink-50">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-400">{children}</div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-500">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger-solid" className="flex-1" busy={busy} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
