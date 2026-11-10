import { useEffect, useState } from 'react'
import { formatMessageTime } from '../../domain/chat.ts'
import { formatDateTime, formatRemaining, remainingMs, roomPhase } from '../../domain/rooms.ts'
import type { DashboardRoom } from '../../hooks/useAdminRooms.ts'
import type { AdminRoom } from '../../services/roomService.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { PencilIcon, TrashIcon } from '../ui/icons.tsx'
import { InviteCodeActions } from './InviteCodeActions.tsx'
import { RoomLabel, RoomLabelForm } from './RoomLabelEditor.tsx'

interface RoomCardProps {
  room: DashboardRoom
  now: Date
  masterKey: CryptoKey
  onDelete: (roomId: string) => Promise<void>
  onEnter: (room: AdminRoom) => Promise<void>
  onRename: (room: AdminRoom, label: string) => Promise<void>
}

const INACTIVE_LABEL = { expired: 'Expirada', purging: 'Em limpeza' } as const
const CONFIRM_WINDOW_MS = 4000

export function RoomCard({ room, now, masterKey, onDelete, onEnter, onRename }: RoomCardProps) {
  const phase = roomPhase(room.status, room.expiresAt, now)
  const active = phase === 'active'
  const hasUnread = active && room.unread > 0
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [entering, setEntering] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A confirmação de exclusão expira sozinha.
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  async function handleEnter() {
    setEntering(true)
    setError(null)
    try {
      await onEnter(room)
    } catch {
      setError('Não foi possível abrir a conversa.')
      setEntering(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(room.id)
    } catch {
      setError('Falha ao excluir. Tente novamente.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <li
      className={`rounded-2xl border px-3.5 py-3 transition-colors duration-300 animate-[fade-in_200ms_ease-out] sm:px-4 ${
        hasUnread ? 'border-accent-500/50 bg-ink-850' : 'border-ink-800 bg-ink-900'
      }`}
    >
      {/* Cabeçalho: estado, nome, não lidas e exclusão */}
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${active && room.hasGuest ? 'bg-accent-500' : 'bg-ink-600'}`}
          aria-hidden
        />
        {renaming ? (
          <RoomLabelForm label={room.label} onSave={(label) => onRename(room, label)} onDone={() => setRenaming(false)} />
        ) : (
          <>
            <div className="flex min-w-0 flex-1">
              <RoomLabel label={room.label} />
            </div>
            {hasUnread && (
              <span
                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 px-2 text-xs font-semibold text-ink-950 animate-[fade-in_200ms_ease-out]"
                aria-label={`${room.unread} mensagens não lidas`}
              >
                {room.unread > 99 ? '99+' : room.unread}
              </span>
            )}
            {active &&
              (confirming ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 shrink-0 rounded-lg bg-danger-500/15 px-3 text-xs font-medium text-danger-500 transition-colors hover:bg-danger-500/25 disabled:opacity-50 animate-[fade-in_150ms_ease-out]"
                >
                  {deleting ? 'Excluindo…' : 'Confirmar'}
                </button>
              ) : (
                <div className="-mr-2 flex shrink-0 items-center">
                  <IconButton label="Renomear conversa" onClick={() => setRenaming(true)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton label="Excluir conversa" tone="danger" onClick={() => setConfirming(true)}>
                    <TrashIcon />
                  </IconButton>
                </div>
              ))}
          </>
        )}
        {!active && <span className="shrink-0 text-xs text-ink-400">{INACTIVE_LABEL[phase]}</span>}
      </div>

      {/* Informações em uma linha cada */}
      <div className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-ink-400">
        {active && (
          <p className="truncate">
            {room.hasGuest ? 'Convidado conectado' : 'Aguardando convidado'}
            {room.lastMessageAt && (
              <span className={hasUnread ? 'text-accent-500' : undefined}>
                {' · '}
                {hasUnread ? 'Nova mensagem' : 'Última'} {formatMessageTime(room.lastMessageAt)}
              </span>
            )}
          </p>
        )}
        <p className="truncate">
          Criada {formatDateTime(room.createdAt)} · Expira {formatDateTime(room.expiresAt)}
        </p>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <InviteCodeActions room={room} masterKey={masterKey} />
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <span className="font-mono text-sm tabular-nums text-ink-50" aria-label="Tempo restante">
              {formatRemaining(remainingMs(room.expiresAt, now))}
              <span className="ml-1.5 font-sans text-xs text-ink-400 sm:hidden">restantes</span>
            </span>
            <Button className="h-10 px-5 text-sm sm:h-9 sm:px-4" busy={entering} onClick={handleEnter}>
              Entrar
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 pl-4 text-xs text-ink-400">
          Conteúdo inacessível. A remoção é concluída automaticamente no servidor.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-500">
          {error}
        </p>
      )}
    </li>
  )
}
