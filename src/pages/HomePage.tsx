import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../app/sessionContext.tsx'
import { Button } from '../components/ui/Button.tsx'
import { ErrorText } from '../components/ui/ErrorText.tsx'
import { ServiceError } from '../services/errors.ts'
import { joinWithCode } from '../services/guestService.ts'

export function HomePage() {
  const navigate = useNavigate()
  const { setRoom, setAdmin } = useSession()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const access = await joinWithCode(code)
      setAdmin(null)
      setRoom({ roomId: access.roomId, roomKey: access.roomKey, role: 'guest' })
      setCode('')
      navigate('/conversa')
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 animate-[fade-in_200ms_ease-out]">
        <label htmlFor="invite-code" className="text-center text-sm text-ink-400">
          Código de acesso
        </label>
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
          className="h-12 rounded-xl border border-ink-700 bg-ink-900 px-4 text-center font-mono text-base tracking-wider text-ink-50 placeholder:text-ink-700 focus:border-ink-400 focus:outline-none"
        />
        <ErrorText message={error} />
        <Button type="submit" busy={busy} className="h-11">
          Entrar
        </Button>
      </form>
      <Link to="/admin" className="mt-16 text-xs text-ink-600 transition-colors hover:text-ink-400">
        Acesso administrativo
      </Link>
    </main>
  )
}
