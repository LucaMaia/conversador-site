import { useEffect, useRef } from 'react'
import type { ChatMessage, SenderRole } from '../../domain/chat.ts'
import { MessageBubble } from './MessageBubble.tsx'

const NEAR_BOTTOM_PX = 120

export function MessageList({ messages, myRole }: { messages: readonly ChatMessage[]; myRole: SenderRole }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const last = messages.at(-1)

  // Rola para a última mensagem quando ela é minha ou quando já estou no fim.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !last) return
    if (nearBottomRef.current || last.senderRole === myRole) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [last, myRole])

  return (
    <div
      ref={containerRef}
      onScroll={(e) => {
        const el = e.currentTarget
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
      }}
      className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
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
}
