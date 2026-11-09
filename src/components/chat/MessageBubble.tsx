import { memo } from 'react'
import { formatMessageTime, type ChatMessage } from '../../domain/chat.ts'
import { systemTemplate } from '../../domain/systemMessages.ts'
import { MediaBubbleContent } from './MediaBubbleContent.tsx'
import { SystemMessageCard } from './SystemMessageCard.tsx'

export const MessageBubble = memo(function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (message.senderRole === 'system') {
    const template = systemTemplate(message.systemTemplate)
    // Modelo desconhecido nunca é exibido como mensagem oficial.
    return template ? (
      <SystemMessageCard template={template} />
    ) : (
      <li className="text-center text-xs text-ink-600">Mensagem do sistema não reconhecida</li>
    )
  }

  const { payload } = message
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-[fade-in_150ms_ease-out]`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[70%] ${
          mine ? 'rounded-br-md bg-[#163a35] text-ink-50' : 'rounded-bl-md bg-ink-800 text-ink-50'
        }`}
      >
        {payload === null ? (
          <p className="text-sm text-ink-400 italic">Mensagem ilegível</p>
        ) : payload.kind === 'text' ? (
          <p className="text-[15px] leading-snug wrap-break-word whitespace-pre-wrap">{payload.text}</p>
        ) : (
          <MediaBubbleContent message={message} payload={payload} mine={mine} />
        )}
        <p className="mt-1 text-right text-[11px] leading-none text-ink-400">
          {message.pending && payload?.kind === 'text' ? 'enviando…' : formatMessageTime(message.createdAt)}
        </p>
      </div>
    </li>
  )
})
