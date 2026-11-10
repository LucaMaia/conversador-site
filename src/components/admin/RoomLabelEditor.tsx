import { useState, type FormEvent } from 'react'
import { MAX_ROOM_LABEL_LENGTH } from '../../lib/crypto/index.ts'

/** Nome da conversa (somente exibição). */
export function RoomLabel({ label }: { label: string | null }) {
  return (
    <h3 className={`truncate text-base font-medium ${label ? 'text-ink-50' : 'text-ink-400 italic'}`}>
      {label ?? 'Sem nome'}
    </h3>
  )
}

interface RoomLabelFormProps {
  label: string | null
  onSave: (label: string) => Promise<void>
  onDone: () => void
}

/** Edição do nome no próprio card. Vazio remove o nome. */
export function RoomLabelForm({ label, onSave, onDone }: RoomLabelFormProps) {
  const [value, setValue] = useState(label ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(false)
    try {
      await onSave(value)
      onDone()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
      <input
        autoFocus
        value={value}
        maxLength={MAX_ROOM_LABEL_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone()
        }}
        placeholder="Nome da pessoa"
        aria-label="Nome da conversa"
        className="h-9 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3 text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none"
      />
      <button type="submit" disabled={saving} className="h-9 shrink-0 px-1 text-xs font-medium text-accent-500 disabled:opacity-50">
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
      <button type="button" onClick={onDone} className="h-9 shrink-0 px-1 text-xs text-ink-400">
        Cancelar
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger-500">
          Falhou
        </span>
      )}
    </form>
  )
}
