import { baseMimeType, formatDuration, pickAudioMimeType } from './audio.ts'

describe('formato de gravação', () => {
  it('prefere MP4/AAC quando disponível (toca no iPhone e no Android)', () => {
    expect(pickAudioMimeType(() => true)).toBe('audio/mp4;codecs=mp4a.40.2')
  })

  it('usa WebM/Opus quando MP4 não é suportado', () => {
    expect(pickAudioMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
  })

  it('retorna null quando o navegador não grava áudio', () => {
    expect(pickAudioMimeType(() => false)).toBeNull()
  })

  it('remove parâmetros de codec', () => {
    expect(baseMimeType('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(baseMimeType('audio/mp4')).toBe('audio/mp4')
  })
})

describe('formatDuration', () => {
  it('formata minutos e segundos', () => {
    expect(formatDuration(7_400)).toBe('0:07')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(-1)).toBe('0:00')
  })
})
