import { useState, type FormEvent } from 'react'
import { MAX_ROOM_LABEL_LENGTH } from '../../lib/crypto/index.ts'

interface RoomLabelEditorProps {
  label: string | null
  editable: boolean
  onSave: (label: string) => Promise<void>
}

/** Nome da conversa com edição no próprio cartão. */
export function RoomLabelEditor({ label, editable, onSave }: RoomLabelEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(false)
    try {
      await onSave(value)
      setEditing(false)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={MAX_ROOM_LABEL_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Nome da pessoa"
          aria-label="Nome da conversa"
          className="h-9 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3 text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none"
        />
        <button type="submit" disabled={saving} className="text-xs font-medium text-accent-500 disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-400">
          Cancelar
        </button>
        {error && <span role="alert" className="text-xs text-danger-500">Falhou</span>}
      </form>
    )
  }

  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <h3 className={`truncate text-base font-medium ${label ? 'text-ink-50' : 'text-ink-400 italic'}`}>
        {label ?? 'Sem nome'}
      </h3>
      {editable && (
        <button
          type="button"
          onClick={() => {
            setValue(label ?? '')
            setEditing(true)
          }}
          className="shrink-0 text-xs text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
        >
          Renomear
        </button>
      )}
    </div>
  )
}
