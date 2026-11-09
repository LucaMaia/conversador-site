import { useEffect, useRef, useState } from 'react'
import { formatDuration, MAX_AUDIO_MS } from '../../domain/audio.ts'
import type { RecordedAudio, RecordingSession } from '../../lib/audioRecorder.ts'

interface AudioRecorderBarProps {
  session: RecordingSession
  /** Duração máxima atingida ou captura interrompida pelo sistema: envia o que foi gravado. */
  autoStop: boolean
  onSend: (audio: RecordedAudio) => void
  onCancel: () => void
  onError: (message: string) => void
}

/** Barra exibida durante a gravação: tempo, cancelar e enviar. */
export function AudioRecorderBar({ session, autoStop, onSend, onCancel, onError }: AudioRecorderBarProps) {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [stopping, setStopping] = useState(false)
  const sentRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  async function stopAndSend() {
    if (sentRef.current) return
    sentRef.current = true
    setStopping(true)
    try {
      onSend(await session.stop())
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha na gravação.')
    }
  }

  useEffect(() => {
    if (autoStop) void stopAndSend()
    // stopAndSend é estável o suficiente: protegido por sentRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStop])

  const elapsed = Math.min(MAX_AUDIO_MS, now - startedAt)

  return (
    <div className="flex min-h-10 flex-1 items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-3">
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger-500" aria-hidden />
      <span className="font-mono text-sm tabular-nums text-ink-50" aria-live="off">
        {formatDuration(elapsed)}
      </span>
      <span className="flex-1 truncate text-xs text-ink-400">Gravando…</span>
      <button
        type="button"
        onClick={onCancel}
        disabled={stopping}
        className="rounded-md px-2 py-1 text-xs text-ink-400 hover:text-danger-500 disabled:opacity-40"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={stopAndSend}
        disabled={stopping}
        aria-label="Enviar áudio"
        onPointerDown={(e) => e.preventDefault()}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-950 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
