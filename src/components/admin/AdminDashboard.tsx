import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { RoomSession } from '../../app/sessionContext.tsx'
import { sortByActivity, totalUnread } from '../../domain/roomOrdering.ts'
import { roomPhase } from '../../domain/rooms.ts'
import { deriveRoomKeys, MAX_ROOM_LABEL_LENGTH, parseInviteCode } from '../../lib/crypto/index.ts'
import { useAdminRooms } from '../../hooks/useAdminRooms.ts'
import { useServerClock } from '../../hooks/useServerClock.ts'
import { ServiceError } from '../../services/errors.ts'
import { revealInviteCode, type AdminRoom } from '../../services/roomService.ts'
import { Button } from '../ui/Button.tsx'
import { ErrorText } from '../ui/ErrorText.tsx'
import { HomeLink } from '../ui/HomeLink.tsx'
import { LogoutIcon } from '../ui/icons.tsx'
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
  const { rooms, loading, error, create, remove, rename } = useAdminRooms(userId, masterKey)
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const { active, inactive } = useMemo(() => {
    const isActive = (status: (typeof rooms)[number]) =>
      roomPhase(status.status, status.expiresAt, now) === 'active'
    return { active: sortByActivity(rooms.filter(isActive)), inactive: rooms.filter((r) => !isActive(r)) }
  }, [rooms, now])

  // Total de não lidas no título da aba: "(3) Mensageiro".
  const unreadTotal = totalUnread(active)
  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) Mensageiro` : 'Mensageiro'
    return () => {
      document.title = 'Mensageiro'
    }
  }, [unreadTotal])

  /** Deriva a chave da sala a partir do código guardado no cofre. */
  async function handleEnter(room: AdminRoom) {
    const code = await revealInviteCode(room, masterKey)
    const { roomKey } = await deriveRoomKeys(parseInviteCode(code).bytes)
    onEnterRoom({ roomId: room.id, roomKey, role: 'admin', label: room.label })
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const { code } = await create(newLabel)
      setNewCode(code)
      setNewLabel('')
    } catch (err) {
      setCreateError(err instanceof ServiceError ? err.message : 'Falha ao criar a conversa.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:gap-6 sm:py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HomeLink className="-ml-2" />
          <h1 className="text-lg font-semibold">Conversas</h1>
        </div>
        {/* Sair também tranca o cofre: a chave só existe em memória. */}
        <button
          type="button"
          onClick={onSignOut}
          className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50"
        >
          <LogoutIcon className="size-4" />
          Sair
        </button>
      </header>

      <StatsBar active={active.length} expired={inactive.length} />

      <div className="flex flex-col gap-3">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={MAX_ROOM_LABEL_LENGTH}
            placeholder="Nome da pessoa (opcional)"
            aria-label="Nome da nova conversa"
            className="h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none sm:flex-1"
          />
          <Button type="submit" busy={creating}>
            Nova conversa
          </Button>
        </form>
        <p className="text-xs text-ink-600">O nome fica cifrado no seu cofre e só você o vê.</p>
        <ErrorText message={createError} />
        {newCode && <NewRoomNotice code={newCode} onClose={() => setNewCode(null)} />}
      </div>

      <ErrorText message={error} />

      <section aria-labelledby="active-heading" className="flex flex-col gap-3">
        <h2 id="active-heading" className="text-xs font-medium tracking-wide text-ink-400 uppercase">
          Ativas
          {unreadTotal > 0 && (
            <span className="ml-2 normal-case tracking-normal text-accent-500">
              {unreadTotal === 1 ? '1 mensagem nova' : `${unreadTotal} mensagens novas`}
            </span>
          )}
        </h2>
        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma conversa ativa.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {active.map((room) => (
              <RoomCard key={room.id} room={room} now={now} masterKey={masterKey} onDelete={remove} onEnter={handleEnter} onRename={rename} />
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <section aria-labelledby="inactive-heading" className="flex flex-col gap-3">
          <h2 id="inactive-heading" className="text-xs font-medium tracking-wide text-ink-400 uppercase">
            Expiradas — aguardando limpeza
          </h2>
          <ul className="flex flex-col gap-2.5">
            {inactive.map((room) => (
              <RoomCard key={room.id} room={room} now={now} masterKey={masterKey} onDelete={remove} onEnter={handleEnter} onRename={rename} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
