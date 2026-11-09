import { MAX_TEXT_LENGTH, parseMessagePayload } from './messagePayload.ts'

const FILE = '44444444-4444-4444-8444-444444444444'

describe('parseMessagePayload', () => {
  it('aceita texto e mídia válidos', () => {
    expect(parseMessagePayload({ v: 1, kind: 'text', text: 'oi' })).toEqual({ v: 1, kind: 'text', text: 'oi' })
    expect(
      parseMessagePayload({ v: 1, kind: 'audio', mime: 'audio/webm', size: 10, fileId: FILE, durationMs: 1500 }),
    ).toMatchObject({ kind: 'audio', durationMs: 1500 })
  })

  it('descarta campos desconhecidos', () => {
    expect(parseMessagePayload({ v: 1, kind: 'text', text: 'oi', html: '<script>' })).toEqual({
      v: 1,
      kind: 'text',
      text: 'oi',
    })
  })

  it('rejeita conteúdo inválido', () => {
    const invalid: unknown[] = [
      null,
      'texto',
      [],
      { v: 2, kind: 'text', text: 'oi' },
      { v: 1, kind: 'text', text: '' },
      { v: 1, kind: 'text', text: 'a'.repeat(MAX_TEXT_LENGTH + 1) },
      { v: 1, kind: 'image', mime: 'text/html', size: 1, fileId: FILE },
      { v: 1, kind: 'video', mime: 'video/mp4', size: -1, fileId: FILE },
      { v: 1, kind: 'video', mime: 'video/mp4', size: 1, fileId: '../../etc' },
      { v: 1, kind: 'image', mime: 'image/png', size: 1, fileId: FILE, width: 1.5 },
      { v: 1, kind: 'file', mime: 'application/pdf', size: 1, fileId: FILE },
    ]
    for (const value of invalid) expect(parseMessagePayload(value)).toBeNull()
  })
})
