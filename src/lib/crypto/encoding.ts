// Utilitários de codificação. Sem dependências externas.

/** Bytes sempre apoiados em ArrayBuffer (exigido pelas assinaturas da Web Crypto). */
export type Bytes = Uint8Array<ArrayBuffer>

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function utf8Encode(text: string): Bytes {
  const encoded = textEncoder.encode(text)
  const out = new Uint8Array(encoded.length)
  out.set(encoded)
  return out
}

export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

// getRandomValues aceita no máximo 65.536 bytes por chamada.
const RANDOM_CHUNK = 65_536

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i += RANDOM_CHUNK) {
    crypto.getRandomValues(out.subarray(i, Math.min(i + RANDOM_CHUNK, length)))
  }
  return out
}

export function concatBytes(...parts: Uint8Array[]): Bytes {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

export function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

// ---------------------------------------------------------------------------
// Base64 (padrão, com padding) — formato aceito pelas colunas do banco.
// ---------------------------------------------------------------------------
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function fromBase64(value: string): Bytes {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new TypeError('Base64 inválido')
  }
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

// ---------------------------------------------------------------------------
// Base32 Crockford (sem I, L, O, U) — usado nos códigos de convite.
// ---------------------------------------------------------------------------
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function toCrockford(bytes: Uint8Array): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const b of bytes) {
    buffer = (buffer << 8) | b
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += CROCKFORD.charAt((buffer >> bits) & 31)
    }
    buffer &= (1 << bits) - 1
  }
  if (bits > 0) out += CROCKFORD.charAt((buffer << (5 - bits)) & 31)
  return out
}

/** Decodifica Crockford já normalizado (maiúsculas, sem separadores). */
export function fromCrockford(value: string, byteLength: number): Bytes {
  const out = new Uint8Array(byteLength)
  let buffer = 0
  let bits = 0
  let index = 0
  for (const ch of value) {
    const v = CROCKFORD.indexOf(ch)
    if (v < 0) throw new TypeError('Caractere inválido')
    buffer = (buffer << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      if (index >= byteLength) throw new TypeError('Comprimento inválido')
      out[index++] = (buffer >> bits) & 0xff
    }
    buffer &= (1 << bits) - 1
  }
  if (index !== byteLength || buffer !== 0) throw new TypeError('Comprimento inválido')
  return out
}
