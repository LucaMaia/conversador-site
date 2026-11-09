import { useState } from 'react'
import { formatDateTime, formatRemaining, remainingMs, roomPhase } from '../../domain/rooms.ts'
import type { AdminRoom } from '../../services/roomService.ts'
import { Button } from '../ui/Button.tsx'
import { InviteCodeActions } from './InviteCodeActions.tsx'

interface RoomCardProps {
  room: AdminRoom
  now: Date
  masterKey: CryptoKey
  onDelete: (roomId: string) => Promise<void>
  onEnter: (room: AdminRoom) => Promise<void>
}

const PHASE_LABEL = { active: 'Ativa', expired: 'Expirada', purging: 'Em limpeza' } as const

export function RoomCard({ room, now, masterKey, onDelete, onEnter }: RoomCardProps) {
  const phase = roomPhase(room.status, room.expiresAt, now)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entering, setEntering] = useState(false)

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
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 4000)
      return
    }
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
    <li className="rounded-xl border border-ink-800 bg-ink-900 p-4 animate-[fade-in_200ms_ease-out]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${phase === 'active' ? 'bg-accent-500' : 'bg-ink-600'}`}
            aria-hidden
          />
          <span className="text-sm font-medium text-ink-200">{PHASE_LABEL[phase]}</span>
          {phase === 'active' && (
            <span className="text-xs text-ink-400">{room.hasGuest ? '· convidado conectado' : '· aguardando convidado'}</span>
          )}
        </div>
        {phase === 'active' && (
          <span className="font-mono text-lg tabular-nums text-ink-50" aria-label="Tempo restante">
            {formatRemaining(remainingMs(room.expiresAt, now))}
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-400 sm:max-w-sm">
        <div>
          <dt>Criada</dt>
          <dd className="text-ink-200">{formatDateTime(room.createdAt)}</dd>
        </div>
        <div>
          <dt>Expira</dt>
          <dd className="text-ink-200">{formatDateTime(room.expiresAt)}</dd>
        </div>
      </dl>

      {phase === 'active' ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InviteCodeActions room={room} masterKey={masterKey} />
          <div className="flex gap-2">
            <Button className="h-8 px-3 text-xs" busy={entering} onClick={handleEnter}>
              Entrar
            </Button>
            <Button variant="danger" className="h-8 px-3 text-xs" busy={deleting} onClick={handleDelete}>
              {confirming ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-400">Conteúdo inacessível. A remoção é concluída automaticamente no servidor.</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger-500">{error}</p>}
    </li>
  )
}
