// Remove metadados de vídeos MP4/MOV (formato ISO BMFF / QuickTime) sem
// recodificar o vídeo.
//
// iPhones e Androids gravam em "moov/udta" e "moov/meta" (e nas trilhas,
// "trak/udta" e "trak/meta") dados como localização GPS (©xyz,
// com.apple.quicktime.location.ISO6709), modelo do aparelho e software.
//
// Estratégia: cada caixa udta/meta é transformada numa caixa "free" do mesmo
// tamanho, com o conteúdo zerado. Como nenhum byte muda de posição, os
// ponteiros internos do arquivo (stco/co64, que apontam para os quadros)
// continuam válidos e o vídeo segue reproduzível.

const CONTAINERS_WITH_METADATA = new Set(['moov', 'trak'])
const METADATA_BOXES = new Set(['udta', 'meta'])

function boxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0)
}

interface Box {
  readonly start: number
  readonly headerSize: number
  readonly end: number
  readonly type: string
}

/** Lê as caixas entre start e end. Retorna null se a estrutura não for válida. */
function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const boxes: Box[] = []
  let offset = start
  while (offset + 8 <= end) {
    let size = view.getUint32(offset)
    let headerSize = 8
    if (size === 1) {
      if (offset + 16 > end) return null
      const big = view.getBigUint64(offset + 8)
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null
      size = Number(big)
      headerSize = 16
    } else if (size === 0) {
      size = end - offset // até o fim do contêiner
    }
    if (size < headerSize || offset + size > end) return null
    boxes.push({ start: offset, headerSize, end: offset + size, type: boxType(bytes, offset) })
    offset += size
  }
  return offset === end ? boxes : null
}

function neutralize(bytes: Uint8Array, box: Box): void {
  // Tipo "free" na mesma posição; conteúdo zerado; tamanho preservado.
  bytes.set([0x66, 0x72, 0x65, 0x65], box.start + 4)
  bytes.fill(0, box.start + box.headerSize, box.end)
}

function scrub(bytes: Uint8Array, start: number, end: number): number {
  const boxes = readBoxes(bytes, start, end)
  if (!boxes) return 0
  let removed = 0
  for (const box of boxes) {
    if (METADATA_BOXES.has(box.type)) {
      neutralize(bytes, box)
      removed++
    } else if (CONTAINERS_WITH_METADATA.has(box.type)) {
      removed += scrub(bytes, box.start + box.headerSize, box.end)
    }
  }
  return removed
}

export interface ScrubResult {
  /** false = não é MP4/MOV reconhecível; nada foi alterado. */
  readonly recognized: boolean
  /** Quantidade de caixas de metadados removidas. */
  readonly removed: number
}

/** Altera os bytes no próprio array. */
export function scrubMp4Metadata(bytes: Uint8Array): ScrubResult {
  const topLevel = readBoxes(bytes, 0, bytes.length)
  if (!topLevel || !topLevel.some((b) => b.type === 'ftyp' || b.type === 'moov')) {
    return { recognized: false, removed: 0 }
  }
  let removed = 0
  for (const box of topLevel) {
    if (box.type === 'moov') removed += scrub(bytes, box.start + box.headerSize, box.end)
    else if (METADATA_BOXES.has(box.type)) {
      neutralize(bytes, box)
      removed++
    }
  }
  return { recognized: true, removed }
}
