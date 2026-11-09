import { formatMegabytes, isIsoBmffVideo, playbackMime } from './video.ts'

describe('vídeo', () => {
  it('reconhece MP4 e MOV para limpeza de metadados', () => {
    expect(isIsoBmffVideo('video/mp4')).toBe(true)
    expect(isIsoBmffVideo('video/quicktime')).toBe(true)
    expect(isIsoBmffVideo('video/webm')).toBe(false)
  })

  it('MOV do iPhone é reproduzido como MP4', () => {
    expect(playbackMime('video/quicktime')).toBe('video/mp4')
    expect(playbackMime('video/webm')).toBe('video/webm')
  })

  it('formata megabytes', () => {
    expect(formatMegabytes(49 * 1024 * 1024)).toBe('49 MB')
  })
})
