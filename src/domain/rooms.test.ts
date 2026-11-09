import { formatRemaining, remainingMs, roomPhase } from './rooms.ts'

const created = new Date('2026-11-09T10:00:00Z')
const expires = new Date('2026-11-10T10:00:00Z')

describe('ciclo de vida da sala', () => {
  it('ativa até o instante exato da expiração', () => {
    expect(roomPhase('active', expires, created)).toBe('active')
    expect(roomPhase('active', expires, new Date('2026-11-10T09:59:59.999Z'))).toBe('active')
    expect(roomPhase('active', expires, expires)).toBe('expired')
  })

  it('purging prevalece sobre o horário', () => {
    expect(roomPhase('purging', expires, created)).toBe('purging')
  })

  it('tempo restante nunca é negativo', () => {
    expect(remainingMs(expires, created)).toBe(24 * 3600 * 1000)
    expect(remainingMs(expires, new Date('2026-11-11T00:00:00Z'))).toBe(0)
  })

  it('formata horas, minutos e segundos', () => {
    expect(formatRemaining(24 * 3600 * 1000)).toBe('24:00:00')
    expect(formatRemaining(3_725_999)).toBe('01:02:05')
    expect(formatRemaining(0)).toBe('00:00:00')
  })
})
