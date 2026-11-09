import { useState, type FormEvent } from 'react'
import {
  createVault,
  CryptoError,
  MIN_PASSPHRASE_LENGTH,
  unlockVault,
  type VaultRecord,
} from '../../lib/crypto/index.ts'
import { ServiceError } from '../../services/errors.ts'
import { saveVaultRecord } from '../../services/vaultService.ts'
import { Button } from '../ui/Button.tsx'
import { CenteredCard } from '../ui/CenteredCard.tsx'
import { ErrorText } from '../ui/ErrorText.tsx'
import { TextField } from '../ui/TextField.tsx'

interface VaultFormProps {
  userId: string
  /** null = primeiro acesso: o cofre será criado. */
  record: VaultRecord | null
  onUnlocked: (masterKey: CryptoKey) => void
  onCancel: () => void
}

export function VaultForm({ userId, record, onUnlocked, onCancel }: VaultFormProps) {
  const creating = record === null
  const [passphrase, setPassphrase] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (creating && passphrase !== confirmation) {
      setError('As frases não coincidem.')
      return
    }
    setBusy(true)
    try {
      if (creating) {
        const created = await createVault(userId, passphrase)
        await saveVaultRecord(userId, created.record)
        onUnlocked(created.masterKey)
      } else {
        onUnlocked(await unlockVault(userId, passphrase, record))
      }
    } catch (err) {
      if (err instanceof CryptoError || err instanceof ServiceError) setError(err.message)
      else setError('Não foi possível abrir o cofre.')
      setPassphrase('')
      setConfirmation('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenteredCard
      title={creating ? 'Criar cofre' : 'Desbloquear cofre'}
      subtitle={
        creating
          ? 'A frase do cofre protege os códigos das conversas. Ela é diferente da senha de login, não sai deste navegador e não pode ser recuperada.'
          : 'Informe a frase do cofre para acessar os códigos das conversas.'
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Frase do cofre"
          type="password"
          autoComplete="off"
          minLength={creating ? MIN_PASSPHRASE_LENGTH : undefined}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
          autoFocus
        />
        {creating && (
          <TextField
            label="Confirmar frase"
            type="password"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        )}
        {creating && (
          <p className="text-xs text-ink-400">Mínimo de {MIN_PASSPHRASE_LENGTH} caracteres. Prefira uma frase com várias palavras.</p>
        )}
        <ErrorText message={error} />
        <Button type="submit" busy={busy} className="mt-2">
          {creating ? 'Criar cofre' : 'Desbloquear'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Sair
        </Button>
      </form>
    </CenteredCard>
  )
}
