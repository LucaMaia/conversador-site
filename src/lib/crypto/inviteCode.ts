// Código de convite: 120 bits aleatórios em Base32 Crockford,
// exibido como 6 grupos de 4 caracteres (ex.: 7KQM-2XZP-9RTA-HC4D-W8NB-0F3E).
//
// O código é o segredo de entrada S. Dele derivam (ver keys.ts):
//   * o token de acesso (enviado ao servidor, que guarda só o hash);
//   * a chave de cifra da sala (nunca sai do navegador).
import { type Bytes, fromCrockford, randomBytes, toCrockford } from './encoding.ts'
import { CryptoError } from './errors.ts'

export const INVITE_SECRET_BYTES = 15
const CODE_CHARS = 24
const GROUP = 4

export interface InviteSecret {
  /** Bytes do segredo (120 bits). */
  readonly bytes: Bytes
  /** Representação canônica para exibir/copiar. */
  readonly code: string
}

function formatGroups(raw: string): string {
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += GROUP) groups.push(raw.slice(i, i + GROUP))
  return groups.join('-')
}

export function generateInviteSecret(): InviteSecret {
  const bytes = randomBytes(INVITE_SECRET_BYTES)
  return { bytes, code: formatGroups(toCrockford(bytes)) }
}

/**
 * Normaliza o que o usuário digitou: ignora espaços e hífens, aceita
 * minúsculas e corrige confusões comuns (O→0, I/L→1).
 */
export function parseInviteCode(input: string): InviteSecret {
  const normalized = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

  if (normalized.length !== CODE_CHARS) {
    throw new CryptoError('invalid_code', 'Código com formato inválido')
  }
  try {
    const bytes = fromCrockford(normalized, INVITE_SECRET_BYTES)
    return { bytes, code: formatGroups(normalized) }
  } catch {
    throw new CryptoError('invalid_code', 'Código com formato inválido')
  }
}
