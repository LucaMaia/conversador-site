import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_TEXT_LENGTH } from '../../domain/messagePayload.ts'

interface ComposerProps {
  disabled: boolean
  onSend: (text: string) => Promise<void>
}

export function Composer({ disabled, onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  async function submit() {
    const value = text
    if (!value.trim() || disabled) return
    setText('')
    requestAnimationFrame(resize)
    await onSend(value)
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha. Em teclados virtuais, o botão envia.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void submit()
      }}
      className="flex items-end gap-2 border-t border-ink-800 bg-ink-900 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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
        className="max-h-[140px] min-h-10 flex-1 resize-none rounded-2xl border border-ink-700 bg-ink-850 px-4 py-2.5 text-[15px] leading-snug text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Enviar"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-950 transition-opacity disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
}
