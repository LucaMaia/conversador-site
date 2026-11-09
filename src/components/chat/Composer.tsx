import { memo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_TEXT_LENGTH } from '../../domain/messagePayload.ts'

interface ComposerProps {
  disabled: boolean
  onSend: (text: string) => Promise<void>
}

/** Em telas de toque, Enter quebra linha (como no WhatsApp) e o botão envia. */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export const Composer = memo(function Composer({ disabled, onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  function submit() {
    const value = text
    if (!value.trim() || disabled) return
    setText('')
    requestAnimationFrame(resize)
    void onSend(value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    if (isTouchDevice()) return
    event.preventDefault()
    submit()
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        submit()
      }}
      className="flex shrink-0 items-end gap-2 border-t border-ink-800 bg-ink-900 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        maxLength={MAX_TEXT_LENGTH}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value)
          resize()
        }}
        onKeyDown={handleKeyDown}
        placeholder="Mensagem"
        aria-label="Mensagem"
        enterKeyHint="enter"
        autoComplete="off"
        className="max-h-[140px] min-h-10 flex-1 resize-none rounded-2xl border border-ink-700 bg-ink-850 px-4 py-2 text-base leading-snug text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Enviar"
        // Impede que o toque no botão tire o foco do campo e feche o teclado.
        onPointerDown={(e) => e.preventDefault()}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-950 transition-opacity active:scale-95 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
})
