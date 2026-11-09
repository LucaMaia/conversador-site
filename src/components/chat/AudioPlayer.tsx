import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../domain/audio.ts'

interface AudioPlayerProps {
  url: string
  /** Duração registrada na gravação (WebM gravado no navegador costuma não informar). */
  fallbackDurationMs: number
}

/** Player compacto. Tenta tocar ao abrir; se o navegador bloquear, espera o toque. */
export function AudioPlayer({ url, fallbackDurationMs }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(fallbackDurationMs)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.play().catch(() => setPlaying(false))
    return () => audio.pause()
  }, [url])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }

  function seek(fraction: number) {
    const audio = audioRef.current
    if (!audio || durationMs <= 0) return
    audio.currentTime = (fraction * durationMs) / 1000
  }

  const progress = durationMs > 0 ? Math.min(1, currentMs / durationMs) : 0

  return (
    <div className="flex items-center gap-3 py-1">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentMs(0)
        }}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d) && d > 0) setDurationMs(d * 1000)
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar' : 'Tocar'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-950 active:scale-95"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden>
            <path d="M7 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L8.5 4.64A1 1 0 0 0 7 5.5Z" />
          </svg>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posição do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs / 1000)}
          aria-valuenow={Math.round(currentMs / 1000)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.1))
            if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 0.1))
          }}
          className="relative h-6 cursor-pointer"
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink-50/20" />
          <div
            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-ink-50"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-ink-400">
          {formatDuration(playing || currentMs > 0 ? currentMs : durationMs)}
        </span>
      </div>
    </div>
  )
}
