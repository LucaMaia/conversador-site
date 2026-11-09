import { mergeMessages, type ChatMessage } from './chat.ts'

function msg(id: string, iso: string, pending = false): ChatMessage {
  return {
    id,
    senderRole: 'guest',
    createdAt: new Date(iso),
    payload: { v: 1, kind: 'text', text: id },
    pending,
    attachmentPath: null,
    mediaViewedAt: null,
    mediaExpiresAt: null,
    mediaPurged: false,
  }
}

describe('mergeMessages', () => {
  it('ordena por horário do servidor', () => {
    const result = mergeMessages([msg('b', '2026-01-01T10:00:02Z')], [msg('a', '2026-01-01T10:00:01Z')])
    expect(result.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('a confirmação do servidor substitui a versão otimista', () => {
    const optimistic = msg('x', '2026-01-01T10:00:05Z', true)
    const confirmed = msg('x', '2026-01-01T10:00:03Z')
    const result = mergeMessages([optimistic], [confirmed])
    expect(result).toEqual([confirmed])
  })

  it('não duplica e não rebaixa uma mensagem confirmada para pendente', () => {
    const confirmed = msg('x', '2026-01-01T10:00:03Z')
    expect(mergeMessages([confirmed], [msg('x', '2026-01-01T10:00:09Z', true)])).toEqual([confirmed])
    expect(mergeMessages([confirmed], [confirmed])).toHaveLength(1)
  })
})
