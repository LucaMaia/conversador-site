import { useState } from 'react'
import { copyText } from '../../lib/clipboard.ts'
import { Button } from '../ui/Button.tsx'

/** Exibe o código recém-criado para o admin copiar e enviar. */
export function NewRoomNotice({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-xl border border-accent-500/30 bg-ink-900 p-4 animate-[fade-in_200ms_ease-out]">
      <p className="text-sm text-ink-200">Conversa criada. Envie este código ao convidado por um canal de confiança:</p>
      <code className="mt-3 block rounded-lg bg-ink-950 px-3 py-3 text-center font-mono text-base tracking-wider text-ink-50 select-all sm:text-lg">
        {code}
      </code>
      <p className="mt-2 text-xs text-ink-400">
        Quem tiver este código entra na conversa e lê o conteúdo. Ele expira junto com a conversa, em 24 horas.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={async () => {
            setCopied(await copyText(code))
          }}
        >
          {copied ? 'Copiado' : 'Copiar código'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  )
}
