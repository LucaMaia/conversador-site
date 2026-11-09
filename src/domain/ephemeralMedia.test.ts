import type { ChatMessage } from './chat.ts'
import { formatMinutes, mediaState, openingStartsTimer } from './ephemeralMedia.ts'

const base: ChatMessage = {
  id: 'm',
  senderRole: 'guest',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  payload: null,
  pending: false,
  attachmentPath: 'r/f',
  mediaViewedAt: null,
  mediaExpiresAt: null,
  mediaPurged: false,
}
const now = new Date('2026-01-01T10:05:00Z')

describe('mídia temporária', () => {
  it('não vista: disponível', () => {
    expect(mediaState(base, now)).toEqual({ kind: 'unviewed' })
  })

  it('vista: conta 15 minutos a partir da abertura', () => {
    const viewed = {
      ...base,
      mediaViewedAt: new Date('2026-01-01T10:00:00Z'),
      mediaExpiresAt: new Date('2026-01-01T10:15:00Z'),
    }
    expect(mediaState(viewed, now)).toMatchObject({ kind: 'viewing', remainingMs: 10 * 60 * 1000 })
    expect(mediaState(viewed, new Date('2026-01-01T10:15:00Z'))).toEqual({ kind: 'expired' })
  })

  it('removida do servidor é sempre expirada', () => {
    expect(mediaState({ ...base, mediaPurged: true }, now)).toEqual({ kind: 'expired' })
  })

  it('só o destinatário inicia a contagem, e só na primeira vez', () => {
    expect(openingStartsTimer(base, 'admin')).toBe(true)
    expect(openingStartsTimer(base, 'guest')).toBe(false)
    expect(openingStartsTimer({ ...base, mediaViewedAt: now }, 'admin')).toBe(false)
  })

  it('formata minutos e segundos', () => {
    expect(formatMinutes(15 * 60 * 1000)).toBe('15:00')
    expect(formatMinutes(61_500)).toBe('01:02')
    expect(formatMinutes(-5)).toBe('00:00')
  })
})
