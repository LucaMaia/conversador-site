import { useCallback, useEffect, useState } from 'react'
import { fetchRoomActivity, subscribeToMessageNotices, type RoomActivity } from '../services/activityService.ts'
import { ServiceError } from '../services/errors.ts'
import { createRoom, deleteRoom, listRooms, renameRoom, type AdminRoom } from '../services/roomService.ts'

const REFRESH_MS = 30_000

export interface DashboardRoom extends AdminRoom {
  readonly unread: number
  readonly lastMessageAt: Date | null
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ServiceError ? err.message : fallback
}

const NO_ACTIVITY: RoomActivity = { unread: 0, lastMessageAt: null }

export function useAdminRooms(adminUserId: string, masterKey: CryptoKey) {
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [activity, setActivity] = useState<Map<string, RoomActivity>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [list, act] = await Promise.all([listRooms(masterKey), fetchRoomActivity()])
      setRooms(list)
      setActivity(act)
      setError(null)
    } catch (err) {
      setError(messageOf(err, 'Falha ao carregar as conversas.'))
    } finally {
      setLoading(false)
    }
  }, [masterKey])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Mensagens novas em tempo real: atualiza contador e última atividade.
  useEffect(
    () =>
      subscribeToMessageNotices((notice) => {
        setActivity((current) => {
          const next = new Map(current)
          const prev = current.get(notice.roomId) ?? NO_ACTIVITY
          next.set(notice.roomId, {
            unread: prev.unread + (notice.senderRole === 'guest' ? 1 : 0),
            lastMessageAt: notice.createdAt,
          })
          return next
        })
      }),
    [],
  )

  const withActivity: DashboardRoom[] = rooms.map((r) => ({ ...r, ...(activity.get(r.id) ?? NO_ACTIVITY) }))

  const create = useCallback(
    async (label: string) => {
      const result = await createRoom(adminUserId, masterKey, label)
      setRooms((current) => [result.room, ...current])
      return result
    },
    [adminUserId, masterKey],
  )

  const remove = useCallback(
    async (roomId: string) => {
      await deleteRoom(roomId)
      setRooms((current) => current.filter((r) => r.id !== roomId))
      void refresh()
    },
    [refresh],
  )

  const rename = useCallback(
    async (room: AdminRoom, label: string) => {
      const saved = await renameRoom(room, masterKey, label)
      setRooms((current) => current.map((r) => (r.id === room.id ? { ...r, label: saved } : r)))
    },
    [masterKey],
  )

  return { rooms: withActivity, loading, error, refresh, create, remove, rename }
}
