import { sortByActivity, totalUnread } from './roomOrdering.ts'

const room = (id: string, created: string, unread: number, last: string | null) => ({
  id,
  createdAt: new Date(created),
  unread,
  lastMessageAt: last ? new Date(last) : null,
})

describe('ordem das conversas no painel', () => {
  it('não lidas primeiro, depois a atividade mais recente', () => {
    const rooms = [
      room('antiga-sem-msg', '2026-01-01T08:00:00Z', 0, null),
      room('recente-lida', '2026-01-01T09:00:00Z', 0, '2026-01-01T11:00:00Z'),
      room('com-nova', '2026-01-01T07:00:00Z', 2, '2026-01-01T10:00:00Z'),
    ]
    expect(sortByActivity(rooms).map((r) => r.id)).toEqual(['com-nova', 'recente-lida', 'antiga-sem-msg'])
  })

  it('soma as não lidas', () => {
    expect(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 3 }])).toBe(5)
  })
})
