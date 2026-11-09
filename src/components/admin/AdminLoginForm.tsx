import { useState, type FormEvent } from 'react'
import { signInAdmin, type AdminIdentity } from '../../services/authService.ts'
import { ServiceError } from '../../services/errors.ts'
import { Button } from '../ui/Button.tsx'
import { CenteredCard } from '../ui/CenteredCard.tsx'
import { ErrorText } from '../ui/ErrorText.tsx'
import { TextField } from '../ui/TextField.tsx'

export function AdminLoginForm({ onSignedIn }: { onSignedIn: (identity: AdminIdentity) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await signInAdmin(login, password))
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Falha ao entrar.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenteredCard title="Acesso administrativo">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <ErrorText message={error} />
        <Button type="submit" busy={busy} className="mt-2">
          Entrar
        </Button>
      </form>
    </CenteredCard>
  )
}
