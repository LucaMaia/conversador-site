import { useState } from 'react'
import { copyText } from '../../lib/clipboard.ts'
import { revealInviteCode, type AdminRoom } from '../../services/roomService.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from '../ui/icons.tsx'

const MASK = '••••-••••-••••-••••-••••-••••'

/** O código só é decifrado no navegador, quando o admin pede. */
export function InviteCodeActions({ room, masterKey }: { room: AdminRoom; masterKey: CryptoKey }) {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decrypt(): Promise<string | null> {
    try {
      return code ?? (await revealInviteCode(room, masterKey))
    } catch {
      setError('Não foi possível decifrar o código.')
      return null
    }
  }

  async function handleReveal() {
    setError(null)
    if (code) {
      setCode(null)
      return
    }
    setCode(await decrypt())
  }

  async function handleCopy() {
    setError(null)
    const value = await decrypt()
    if (!value) return
    if (await copyText(value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setError('Não foi possível copiar.')
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <code
          className="min-w-0 flex-1 rounded-lg bg-ink-950 px-2.5 py-2.5 font-mono text-xs leading-snug break-all text-ink-200 select-all sm:flex-none sm:px-3 sm:text-sm sm:tracking-wider"
          aria-label={code ? 'Código de acesso' : 'Código de acesso oculto'}
        >
          {code ?? MASK}
        </code>
        <IconButton label={code ? 'Ocultar código' : 'Mostrar código'} aria-pressed={code !== null} onClick={handleReveal}>
          {code ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
        <IconButton label={copied ? 'Código copiado' : 'Copiar código'} onClick={handleCopy}>
          {copied ? <CheckIcon className="text-accent-500" /> : <CopyIcon />}
        </IconButton>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Código copiado' : ''}
      </span>
      {error && (
        <span role="alert" className="text-xs text-danger-500">
          {error}
        </span>
      )}
    </div>
  )
}
