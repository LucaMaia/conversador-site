import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomSession } from '../app/sessionContext.tsx'
import { mergeMessages, type ChatMessage } from '../domain/chat.ts'
import { MAX_TEXT_LENGTH } from '../domain/messagePayload.ts'
import { fetchMessages, sendMessage, subscribeToMessages } from '../services/messageService.ts'
import { fetchRoomInfo } from '../services/roomAccessService.ts'

const ACCESS_CHECK_MS = 15_000

export type ChatEndReason = 'expired' | 'revoked'

export type ChatStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'ended'; reason: ChatEndReason }
  | { kind: 'error'; message: string }

export function useRoomChat(session: RoomSession, now: Date) {
  const { roomId, roomKey, role } = session
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>({ kind: 'loading' })
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [connected, setConnected] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const endedRef = useRef(false)

  const end = useCallback((reason: ChatEndReason) => {
    if (endedRef.current) return
    endedRef.current = true
    setMessages([]) // apaga o conteúdo decifrado da memória
    setStatus({ kind: 'ended', reason })
  }, [])

  const checkAccess = useCallback(async () => {
    try {
      const info = await fetchRoomInfo(roomId)
      if (!info) end('revoked')
      return info
    } catch {
      return null
    }
  }, [roomId, end])

  // Carga inicial, tempo real e verificação periódica de acesso.
  useEffect(() => {
    endedRef.current = false
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    void (async () => {
      const info = await checkAccess()
      if (cancelled || !info) return
      setExpiresAt(info.expiresAt)

      unsubscribe = subscribeToMessages(
        roomId,
        roomKey,
        (message) => {
          if (!endedRef.current) setMessages((current) => mergeMessages(current, [message]))
        },
        setConnected,
      )

      try {
        const initial = await fetchMessages(roomId, roomKey)
        if (!cancelled && !endedRef.current) {
          setMessages((current) => mergeMessages(current, initial))
          setStatus({ kind: 'ready' })
        }
      } catch {
        if (!cancelled) setStatus({ kind: 'error', message: 'Não foi possível carregar as mensagens.' })
      }
    })()

    const timer = setInterval(() => void checkAccess(), ACCESS_CHECK_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
      unsubscribe?.()
    }
  }, [roomId, roomKey, checkAccess])

  // Expiração pelo relógio do servidor (a RLS já bloqueia no mesmo instante).
  const expired = expiresAt !== null && now.getTime() >= expiresAt.getTime()
  useEffect(() => {
    if (expired) end('expired')
  }, [expired, end])

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || endedRef.current) return
      if (trimmed.length > MAX_TEXT_LENGTH) {
        setSendError(`Limite de ${MAX_TEXT_LENGTH} caracteres.`)
        return
      }
      setSendError(null)
      const id = crypto.randomUUID()
      const payload = { v: 1, kind: 'text', text: trimmed } as const
      setMessages((current) =>
        mergeMessages(current, [{ id, senderRole: role, createdAt: new Date(), payload, pending: true }]),
      )
      try {
        const confirmed = await sendMessage(roomId, roomKey, id, payload)
        if (!endedRef.current) setMessages((current) => mergeMessages(current, [confirmed]))
      } catch {
        setMessages((current) => current.filter((m) => m.id !== id))
        setSendError('Mensagem não enviada.')
        void checkAccess()
      }
    },
    [roomId, roomKey, role, checkAccess],
  )

  return { messages, status, expiresAt, connected, sendError, sendText }
}
