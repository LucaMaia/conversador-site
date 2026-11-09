import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type ParticipantRole = 'admin' | 'guest'

/** Sessão do admin: existe só em memória (recarregar a página tranca o cofre). */
export interface AdminSession {
  readonly userId: string
  readonly masterKey: CryptoKey
}

/** Acesso a uma sala: a chave não é exportável e vive só em memória. */
export interface RoomSession {
  readonly roomId: string
  readonly roomKey: CryptoKey
  readonly role: ParticipantRole
  /** Nome da conversa, só para o admin (decifrado do cofre). */
  readonly label?: string | null
}

interface SessionContextValue {
  admin: AdminSession | null
  room: RoomSession | null
  setAdmin: (session: AdminSession | null) => void
  setRoom: (session: RoomSession | null) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null)
  const [room, setRoom] = useState<RoomSession | null>(null)
  const value = useMemo(() => ({ admin, room, setAdmin, setRoom }), [admin, room])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider')
  return ctx
}
