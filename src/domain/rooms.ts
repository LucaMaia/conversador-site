// Regras de exibição do ciclo de vida de uma sala. A autoridade sobre a
// expiração é sempre o servidor (RLS + trigger); aqui só se calcula o que
// mostrar, usando a hora do servidor (ver useServerClock).

export type RoomServerStatus = 'active' | 'purging'

/** Como a sala aparece no painel. */
export type RoomPhase = 'active' | 'expired' | 'purging'

export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000

export function roomPhase(status: RoomServerStatus, expiresAt: Date, now: Date): RoomPhase {
  if (status === 'purging') return 'purging'
  return expiresAt.getTime() > now.getTime() ? 'active' : 'expired'
}

export function remainingMs(expiresAt: Date, now: Date): number {
  return Math.max(0, expiresAt.getTime() - now.getTime())
}

/** "23:59:59" — horas, minutos e segundos restantes. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date)
}
