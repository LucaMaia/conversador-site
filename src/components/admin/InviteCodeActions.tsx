import { useState } from 'react'
import { copyText } from '../../lib/clipboard.ts'
import { revealInviteCode, type AdminRoom } from '../../services/roomService.ts'
import { Button } from '../ui/Button.tsx'

const MASK = '••••-••••-••••-••••-••••-••••'

/** O código só é decifrado no navegador, quando o admin pede. */
export function InviteCodeActions({ room, masterKey }: { room: AdminRoom; masterKey: CryptoKey }) {
  const [code, setCode] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function decrypt(): Promise<string | null> {
    try {
      return code ?? (await revealInviteCode(room, masterKey))
    } catch {
      setFeedback('Não foi possível decifrar o código.')
      return null
    }
  }

  async function handleReveal() {
    if (code) {
      setCode(null)
      return
    }
    setCode(await decrypt())
  }

  async function handleCopy() {
    const value = await decrypt()
    if (!value) return
    setFeedback((await copyText(value)) ? 'Copiado' : 'Não foi possível copiar')
    setTimeout(() => setFeedback(null), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-md bg-ink-950 px-2.5 py-1.5 font-mono text-sm tracking-wider text-ink-200 select-all">
        {code ?? MASK}
      </code>
      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={handleReveal}>
        {code ? 'Ocultar' : 'Mostrar'}
      </Button>
      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={handleCopy}>
        Copiar
      </Button>
      {feedback && <span className="text-xs text-ink-400" role="status">{feedback}</span>}
    </div>
  )
}
