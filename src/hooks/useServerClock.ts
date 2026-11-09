import { useEffect, useState } from 'react'
import { fetchServerClockOffset } from '../services/serverTimeService.ts'

const TICK_MS = 1000
const RESYNC_MS = 5 * 60 * 1000

export interface ServerClock {
  /** Hora atual estimada do servidor. */
  readonly now: Date
  /** true depois da primeira sincronização com o servidor. */
  readonly synced: boolean
}

/** Relógio que avança a cada segundo e se ressincroniza com o servidor. */
export function useServerClock(): ServerClock {
  const [offset, setOffset] = useState<number | null>(null)
  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      fetchServerClockOffset()
        .then((value) => {
          if (!cancelled) setOffset(value)
        })
        .catch(() => {
          // Mantém o último offset conhecido; a validação real é no servidor.
        })
    }
    sync()
    const resync = setInterval(sync, RESYNC_MS)
    const ticker = setInterval(() => setTick(Date.now()), TICK_MS)
    return () => {
      cancelled = true
      clearInterval(resync)
      clearInterval(ticker)
    }
  }, [])

  return { now: new Date(tick + (offset ?? 0)), synced: offset !== null }
}
