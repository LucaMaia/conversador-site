export interface RoomForOrdering {
  readonly id: string
  readonly createdAt: Date
  readonly unread: number
  readonly lastMessageAt: Date | null
}

/** Conversas com mensagens não lidas primeiro; depois, a atividade mais recente. */
export function sortByActivity<T extends RoomForOrdering>(rooms: readonly T[]): T[] {
  const activity = (r: T) => (r.lastMessageAt ?? r.createdAt).getTime()
  return [...rooms].sort((a, b) => {
    const unreadOrder = Number(b.unread > 0) - Number(a.unread > 0)
    return unreadOrder || activity(b) - activity(a) || a.id.localeCompare(b.id)
  })
}

export function totalUnread(rooms: readonly { unread: number }[]): number {
  return rooms.reduce((sum, r) => sum + r.unread, 0)
}
