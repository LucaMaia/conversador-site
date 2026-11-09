import { useMemo, useState } from 'react'
import type { RoomSession } from '../../app/sessionContext.tsx'
import { roomPhase } from '../../domain/rooms.ts'
import { deriveRoomKeys, parseInviteCode } from '../../lib/crypto/index.ts'
import { useAdminRooms } from '../../hooks/useAdminRooms.ts'
import { useServerClock } from '../../hooks/useServerClock.ts'
import { ServiceError } from '../../services/errors.ts'
import { revealInviteCode, type AdminRoom } from '../../services/roomService.ts'
import { Button } from '../ui/Button.tsx'
import { ErrorText } from '../ui/ErrorText.tsx'
import { NewRoomNotice } from './NewRoomNotice.tsx'
import { RoomCard } from './RoomCard.tsx'
import { StatsBar } from './StatsBar.tsx'

interface AdminDashboardProps {
  userId: string
  masterKey: CryptoKey
  onSignOut: () => void
  onEnterRoom: (session: RoomSession) => void
}

export function AdminDashboard({ userId, masterKey, onSignOut, onEnterRoom }: AdminDashboardProps) {
  const { now } = useServerClock()
  const { rooms, loading, error, create, remove } = useAdminRooms(userId, masterKey)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const { active, inactive } = useMemo(() => {
    const isActive = (status: (typeof rooms)[number]) =>
      roomPhase(status.status, status.expiresAt, now) === 'active'
    return { active: rooms.filter(isActive), inactive: rooms.filter((r) => !isActive(r)) }
  }, [rooms, now])

  /** Deriva a chave da sala a partir do código guardado no cofre. */
  async function handleEnter(room: AdminRoom) {
    const code = await revealInviteCode(room, masterKey)
    const { roomKey } = await deriveRoomKeys(parseInviteCode(code).bytes)
    onEnterRoom({ roomId: room.id, roomKey, role: 'admin' })
  }

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)
    try {
      const { code } = await create()
      setNewCode(code)
    } catch (err) {
      setCreateError(err instanceof ServiceError ? err.message : 'Falha ao criar a conversa.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Conversas</h1>
        <Button variant="ghost" className="h-9 text-xs" onClick={onSignOut}>
          Sair e bloquear
        </Button>
      </header>

      <StatsBar active={active.length} expired={inactive.length} />

      <div className="flex flex-col gap-3">
        <Button onClick={handleCreate} busy={creating} className="self-start">
          Nova conversa
        </Button>
        <ErrorText message={createError} />
        {newCode && <NewRoomNotice code={newCode} onClose={() => setNewCode(null)} />}
      </div>

      <ErrorText message={error} />

      <section aria-labelledby="active-heading" className="flex flex-col gap-3">
        <h2 id="active-heading" className="text-xs font-medium tracking-wide text-ink-400 uppercase">
          Ativas
        </h2>
        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma conversa ativa.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((room) => (
              <RoomCard key={room.id} room={room} now={now} masterKey={masterKey} onDelete={remove} onEnter={handleEnter} />
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <section aria-labelledby="inactive-heading" className="flex flex-col gap-3">
          <h2 id="inactive-heading" className="text-xs font-medium tracking-wide text-ink-400 uppercase">
            Expiradas — aguardando limpeza
          </h2>
          <ul className="flex flex-col gap-3">
            {inactive.map((room) => (
              <RoomCard key={room.id} room={room} now={now} masterKey={masterKey} onDelete={remove} onEnter={handleEnter} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
