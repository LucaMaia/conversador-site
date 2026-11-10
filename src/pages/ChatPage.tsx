import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSession, type RoomSession } from '../app/sessionContext.tsx'
import { ChatHeader } from '../components/chat/ChatHeader.tsx'
import { Composer } from '../components/chat/Composer.tsx'
import { MessageList } from '../components/chat/MessageList.tsx'
import { RoomMediaProvider } from '../components/chat/roomMediaContext.tsx'
import { Button } from '../components/ui/Button.tsx'
import { CenteredCard } from '../components/ui/CenteredCard.tsx'
import { useRoomChat, type ChatEndReason } from '../hooks/useRoomChat.ts'
import { useServerClock } from '../hooks/useServerClock.ts'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight.ts'
import { markRoomRead } from '../services/activityService.ts'
import { signOut } from '../services/authService.ts'
import { ServiceError } from '../services/errors.ts'
import { deleteRoom } from '../services/roomService.ts'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx'

export function ChatPage() {
  const { room, admin } = useSession()
  // Sem sessão de conversa em memória (ex.: página recarregada):
  // o admin desbloqueado volta ao painel; os demais, à tela do código.
  if (!room) return <Navigate to={admin ? '/admin' : '/'} replace />
  return <ChatRoom key={room.roomId} session={room} />
}

const END_TEXT: Record<ChatEndReason | 'deleted', { title: string; body: string }> = {
  deleted: {
    title: 'Conversa apagada',
    body: 'A conversa, as mensagens, fotos, vídeos e áudios foram apagados para os dois participantes.',
  },
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
  const { messages, status, expiresAt, connected, sendError, sendText, sendImage, sendVideo, sendAudio } = useRoomChat(session, now)
  const viewportHeight = useVisualViewportHeight()
  const isAdmin = session.role === 'admin'

  // Admin com a conversa aberta: tudo que chega já conta como lido.
  const messageCount = messages.length
  useEffect(() => {
    if (!isAdmin || status.kind !== 'ready') return
    markRoomRead(session.roomId).catch(() => {})
  }, [isAdmin, status.kind, messageCount, session.roomId])

  // Admin e convidado podem apagar a conversa pelo chat (para os dois).
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteRoom(session.roomId)
      setConfirmingDelete(false)
      setDeleted(true)
    } catch (err) {
      setDeleteError(err instanceof ServiceError ? err.message : 'Não foi possível apagar a conversa.')
    } finally {
      setDeleting(false)
    }
  }

  async function leave() {
    // O React Router aplica a navegação depois da limpeza da sessão; nesse
    // intervalo, o redirecionamento de "sem sessão" acima leva o admin ao painel.
    if (isAdmin) {
      await markRoomRead(session.roomId).catch(() => {})
      navigate('/admin')
      setRoom(null)
    } else {
      navigate('/', { replace: true })
      setRoom(null)
      await signOut()
    }
  }

  if (deleted || status.kind === 'ended') {
    const text = END_TEXT[deleted ? 'deleted' : status.kind === 'ended' ? status.reason : 'revoked']
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
        title={isAdmin ? (session.label ?? 'Conversa sem nome') : 'Conversa privada'}
        expiresAt={expiresAt}
        now={now}
        connected={connected}
        onLeave={leave}
        leaveLabel={isAdmin ? '← Painel' : 'Sair'}
        onDelete={() => setConfirmingDelete(true)}
      />
      {confirmingDelete && (
        <ConfirmDialog
          title="Apagar conversa?"
          confirmLabel="Apagar"
          busy={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            setConfirmingDelete(false)
            setDeleteError(null)
          }}
        >
          A conversa será apagada agora <strong className="text-ink-200">para você e para a outra pessoa</strong>:
          mensagens, fotos, vídeos e áudios. Não é possível desfazer.
        </ConfirmDialog>
      )}
      {status.kind === 'loading' ? (
        <p className="min-h-0 flex-1 pt-10 text-center text-sm text-ink-400">Carregando…</p>
      ) : status.kind === 'error' ? (
        <p role="alert" className="flex-1 pt-10 text-center text-sm text-danger-500">
          {status.message}
        </p>
      ) : (
        <RoomMediaProvider roomId={session.roomId} roomKey={session.roomKey} myRole={session.role}>
          <MessageList messages={messages} myRole={session.role} />
        </RoomMediaProvider>
      )}
      {sendError && (
        <p role="alert" className="bg-ink-900 px-4 pt-2 text-xs text-danger-500">
          {sendError}
        </p>
      )}
      <Composer disabled={status.kind !== 'ready'} onSend={sendText} onSendImage={sendImage} onSendVideo={sendVideo} onSendAudio={sendAudio} />
    </div>
  )
}
