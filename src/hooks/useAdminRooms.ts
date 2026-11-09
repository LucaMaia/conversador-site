import { useCallback, useEffect, useState } from 'react'
import { ServiceError } from '../services/errors.ts'
import { createRoom, deleteRoom, listRooms, type AdminRoom } from '../services/roomService.ts'

const REFRESH_MS = 30_000

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ServiceError ? err.message : fallback
}

export function useAdminRooms(adminUserId: string, masterKey: CryptoKey) {
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRooms(await listRooms())
      setError(null)
    } catch (err) {
      setError(messageOf(err, 'Falha ao carregar as conversas.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const create = useCallback(async () => {
    const result = await createRoom(adminUserId, masterKey)
    setRooms((current) => [result.room, ...current])
    return result
  }, [adminUserId, masterKey])

  const remove = useCallback(
    async (roomId: string) => {
      await deleteRoom(roomId)
      setRooms((current) => current.filter((r) => r.id !== roomId))
      void refresh()
    },
    [refresh],
  )

  return { rooms, loading, error, refresh, create, remove }
}
