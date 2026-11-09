import { Navigate, useNavigate } from 'react-router-dom'
import { useSession, type RoomSession } from '../app/sessionContext.tsx'
import { ChatHeader } from '../components/chat/ChatHeader.tsx'
import { Composer } from '../components/chat/Composer.tsx'
import { MessageList } from '../components/chat/MessageList.tsx'
import { Button } from '../components/ui/Button.tsx'
import { CenteredCard } from '../components/ui/CenteredCard.tsx'
import { useRoomChat, type ChatEndReason } from '../hooks/useRoomChat.ts'
import { useServerClock } from '../hooks/useServerClock.ts'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight.ts'
import { signOut } from '../services/authService.ts'

export function ChatPage() {
  const { room } = useSession()
  // Sem sessão em memória (ex.: página recarregada) => volta à tela inicial.
  if (!room) return <Navigate to="/" replace />
  return <ChatRoom key={room.roomId} session={room} />
}

const END_TEXT: Record<ChatEndReason, { title: string; body: string }> = {
  expired: {
    title: 'Conversa expirada',
    body: 'O prazo de 24 horas terminou. O conteúdo não pode mais ser acessado e está sendo removido do servidor.',
  },
  revoked: {
    title: 'Acesso encerrado',
    body: 'A conversa foi excluída, expirou ou o código foi usado em outro aparelho.',
  },
}

function ChatRoom({ session }: { session: RoomSession }) {
  const navigate = useNavigate()
  const { setRoom } = useSession()
  const { now } = useServerClock()
  const { messages, status, expiresAt, connected, sendError, sendText } = useRoomChat(session, now)
  const viewportHeight = useVisualViewportHeight()
  const isAdmin = session.role === 'admin'

  async function leave() {
    setRoom(null)
    if (isAdmin) {
      navigate('/admin')
    } else {
      await signOut()
      navigate('/', { replace: true })
    }
  }

  if (status.kind === 'ended') {
    const text = END_TEXT[status.reason]
    return (
      <CenteredCard title={text.title} subtitle={text.body}>
        <Button onClick={leave}>{isAdmin ? 'Voltar ao painel' : 'Sair'}</Button>
      </CenteredCard>
    )
  }

  return (
    <div
      className="fixed inset-x-0 top-0 flex h-dvh flex-col overflow-hidden bg-ink-950"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      <ChatHeader
        title={isAdmin ? 'Conversa (admin)' : 'Conversa privada'}
        expiresAt={expiresAt}
        now={now}
        connected={connected}
        onLeave={leave}
        leaveLabel={isAdmin ? '← Painel' : 'Sair'}
      />
      {status.kind === 'loading' ? (
        <p className="min-h-0 flex-1 pt-10 text-center text-sm text-ink-400">Carregando…</p>
      ) : status.kind === 'error' ? (
        <p role="alert" className="flex-1 pt-10 text-center text-sm text-danger-500">
          {status.message}
        </p>
      ) : (
        <MessageList messages={messages} myRole={session.role} />
      )}
      {sendError && (
        <p role="alert" className="bg-ink-900 px-4 pt-2 text-xs text-danger-500">
          {sendError}
        </p>
      )}
      <Composer disabled={status.kind !== 'ready'} onSend={sendText} />
    </div>
  )
}
