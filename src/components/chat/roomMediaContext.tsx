import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SenderRole } from '../../domain/chat.ts'

interface RoomMediaContextValue {
  readonly roomId: string
  readonly roomKey: CryptoKey
  readonly myRole: SenderRole
  /** URLs de imagens já decifradas nesta sessão (só em memória). */
  readonly cache: Map<string, string>
}

const RoomMediaContext = createContext<RoomMediaContextValue | null>(null)

export function RoomMediaProvider({
  roomId,
  roomKey,
  myRole,
  children,
}: {
  roomId: string
  roomKey: CryptoKey
  myRole: SenderRole
  children: ReactNode
}) {
  const [cache] = useState(() => new Map<string, string>())
  const value = useMemo(() => ({ roomId, roomKey, myRole, cache }), [roomId, roomKey, myRole, cache])

  // Ao sair da conversa, descarta as imagens decifradas da memória.
  useEffect(() => {
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url)
      cache.clear()
    }
  }, [cache])

  return <RoomMediaContext.Provider value={value}>{children}</RoomMediaContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoomMedia(): RoomMediaContextValue {
  const ctx = useContext(RoomMediaContext)
  if (!ctx) throw new Error('useRoomMedia precisa de RoomMediaProvider')
  return ctx
}
