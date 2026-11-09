import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { ChatMessage, SenderRole } from '../../domain/chat.ts'
import { MessageBubble } from './MessageBubble.tsx'

const NEAR_BOTTOM_PX = 120

interface MessageListProps {
  messages: readonly ChatMessage[]
  myRole: SenderRole
}

// memo: o contador do cabeçalho atualiza a cada segundo e não deve
// redesenhar a lista de mensagens.
export const MessageList = memo(function MessageList({ messages, myRole }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const firstScrollRef = useRef(true)
  const last = messages.at(-1)

  // Rola para a última mensagem quando ela é minha ou quando já estou no fim.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !last) return
    if (firstScrollRef.current) {
      firstScrollRef.current = false
      el.scrollTop = el.scrollHeight
      return
    }
    if (nearBottomRef.current || last.senderRole === myRole) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [last, myRole])

  // Teclado abrindo/fechando muda a altura: mantém a última mensagem visível.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      onScroll={(e) => {
        const el = e.currentTarget
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [-webkit-overflow-scrolling:touch] sm:px-6"
    >
      {messages.length === 0 ? (
        <p className="mt-10 text-center text-xs text-ink-600">
          Nenhuma mensagem ainda. O conteúdo é cifrado neste aparelho antes do envio.
        </p>
      ) : (
        <ul className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.senderRole === myRole} />
          ))}
        </ul>
      )}
    </div>
  )
})
