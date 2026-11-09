// @vitest-environment node
import { scrubMp4Metadata } from './mp4Metadata.ts'

const enc = new TextEncoder()

/** Tipo de caixa: 4 bytes (Latin-1; o "©" dos metadados QuickTime é o byte 0xA9). */
const fourCC = (type: string) => Uint8Array.from(type, (c) => c.charCodeAt(0))

/** Monta uma caixa: tamanho (u32) + tipo + conteúdo. */
function box(type: string, ...children: Uint8Array[]): Uint8Array {
  const payload = children.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(8 + payload)
  new DataView(out.buffer).setUint32(0, out.length)
  out.set(fourCC(type), 4)
  let o = 8
  for (const c of children) {
    out.set(c, o)
    o += c.length
  }
  return out
}

const raw = (text: string) => enc.encode(text)
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
const contains = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text))

const GPS = '+23.5505-046.6333/'

function sampleVideo() {
  return concat(
    box('ftyp', raw('isom0000')),
    box(
      'moov',
      box('mvhd', raw('header-do-filme')),
      box('trak', box('tkhd', raw('trilha')), box('mdia', raw('midia')), box('udta', box('©xyz', raw(GPS)))),
      box('udta', box('©xyz', raw(GPS)), box('©mak', raw('Apple'))),
      box('meta', raw('com.apple.quicktime.location.ISO6709' + GPS)),
    ),
    box('mdat', raw('QUADROS-DO-VIDEO')),
  )
}

describe('remoção de metadados de vídeo', () => {
  it('remove localização e dados do aparelho', () => {
    const video = sampleVideo()
    expect(contains(video, GPS)).toBe(true)
    const result = scrubMp4Metadata(video)
    expect(result).toEqual({ recognized: true, removed: 3 })
    expect(contains(video, GPS)).toBe(false)
    expect(contains(video, 'Apple')).toBe(false)
    expect(contains(video, 'location')).toBe(false)
  })

  it('preserva tamanho, posições e o conteúdo do vídeo', () => {
    const video = sampleVideo()
    const before = video.length
    const mdatAt = Buffer.from(video).indexOf('QUADROS-DO-VIDEO')
    scrubMp4Metadata(video)
    expect(video.length).toBe(before)
    expect(Buffer.from(video).indexOf('QUADROS-DO-VIDEO')).toBe(mdatAt)
    expect(contains(video, 'header-do-filme')).toBe(true)
    expect(contains(video, 'trilha')).toBe(true)
  })

  it('a estrutura continua válida (caixas viram "free")', () => {
    const video = sampleVideo()
    scrubMp4Metadata(video)
    expect(contains(video, 'free')).toBe(true)
    // Rodar de novo não encontra mais nada para remover.
    expect(scrubMp4Metadata(video)).toEqual({ recognized: true, removed: 0 })
  })

  it('não altera arquivos que não são MP4/MOV', () => {
    const notVideo = raw('isto nao e um video mp4 valido')
    const copy = notVideo.slice()
    expect(scrubMp4Metadata(notVideo)).toEqual({ recognized: false, removed: 0 })
    expect(notVideo).toEqual(copy)
  })

  it('aceita caixa com tamanho de 64 bits', () => {
    const mdat64 = new Uint8Array(16 + 4)
    const view = new DataView(mdat64.buffer)
    view.setUint32(0, 1)
    mdat64.set(raw('mdat'), 4)
    view.setBigUint64(8, BigInt(mdat64.length))
    const video = concat(box('ftyp', raw('isom')), box('moov', box('udta', raw(GPS))), mdat64)
    expect(scrubMp4Metadata(video).removed).toBe(1)
    expect(contains(video, GPS)).toBe(false)
  })
})
