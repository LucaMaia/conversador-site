import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_TEXT_LENGTH } from '../../domain/messagePayload.ts'
import { RecorderError, startRecording, type RecordedAudio, type RecordingSession } from '../../lib/audioRecorder.ts'
import { AudioRecorderBar } from './AudioRecorderBar.tsx'
import { MediaSendPreview } from './MediaSendPreview.tsx'
import { MicIcon } from './MediaBubbleContent.tsx'

interface ComposerProps {
  disabled: boolean
  onSend: (text: string) => Promise<void>
  onSendImage: (file: File) => Promise<void>
  onSendVideo: (file: File) => Promise<void>
  onSendAudio: (audio: RecordedAudio) => Promise<void>
}

/** Em telas de toque, Enter quebra linha (como no WhatsApp) e o botão envia. */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const ROUND_BUTTON =
  'flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-950 transition-opacity active:scale-95 disabled:opacity-30'

export const Composer = memo(function Composer({ disabled, onSend, onSendImage, onSendVideo, onSendAudio }: ComposerProps) {
  const [text, setText] = useState('')
  const [pendingMedia, setPendingMedia] = useState<File | null>(null)
  const [recording, setRecording] = useState<RecordingSession | null>(null)
  const [autoStop, setAutoStop] = useState(false)
  const [startingMic, setStartingMic] = useState(false)
  const [recorderError, setRecorderError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sair da conversa durante a gravação descarta o áudio e libera o microfone.
  useEffect(() => () => recording?.cancel(), [recording])

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  function submit() {
    const value = text
    if (!value.trim() || disabled) return
    setText('')
    requestAnimationFrame(resize)
    void onSend(value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    if (isTouchDevice()) return
    event.preventDefault()
    submit()
  }

  async function startAudio() {
    setRecorderError(null)
    setAutoStop(false)
    setStartingMic(true)
    try {
      // Chamado diretamente do toque: o pedido de permissão do iOS depende disso.
      setRecording(await startRecording(() => setAutoStop(true)))
    } catch (err) {
      setRecorderError(err instanceof RecorderError ? err.message : 'Não foi possível gravar.')
    } finally {
      setStartingMic(false)
    }
  }

  return (
    <>
      {pendingMedia && (
        <MediaSendPreview
          file={pendingMedia}
          onCancel={() => setPendingMedia(null)}
          onConfirm={() => {
            const file = pendingMedia
            setPendingMedia(null)
            void (file.type.startsWith('video/') ? onSendVideo(file) : onSendImage(file))
          }}
        />
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          submit()
        }}
        className="flex shrink-0 items-end gap-2 border-t border-ink-800 bg-ink-900 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {recording ? (
          <AudioRecorderBar
            session={recording}
            autoStop={autoStop}
            onSend={(audio) => {
              setRecording(null)
              void onSendAudio(audio)
            }}
            onCancel={() => {
              recording.cancel()
              setRecording(null)
            }}
            onError={(message) => {
              setRecording(null)
              setRecorderError(message)
            }}
          />
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) setPendingMedia(file)
              }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Enviar foto ou vídeo"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m21 16-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              maxLength={MAX_TEXT_LENGTH}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value)
                resize()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem"
              aria-label="Mensagem"
              enterKeyHint="enter"
              autoComplete="off"
              className="max-h-[140px] min-h-10 flex-1 resize-none rounded-2xl border border-ink-700 bg-ink-850 px-4 py-2 text-base leading-snug text-ink-50 placeholder:text-ink-600 focus:border-ink-400 focus:outline-none disabled:opacity-50"
            />

            {text.trim() ? (
              <button
                type="submit"
                disabled={disabled}
                aria-label="Enviar"
                // Impede que o toque no botão tire o foco do campo e feche o teclado.
                onPointerDown={(e) => e.preventDefault()}
                className={ROUND_BUTTON}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled || startingMic}
                onClick={startAudio}
                aria-label="Gravar áudio"
                className={ROUND_BUTTON}
              >
                <MicIcon />
              </button>
            )}
          </>
        )}
      </form>

      {recorderError && (
        <p role="alert" className="bg-ink-900 px-4 pb-2 text-xs text-danger-500">
          {recorderError}
        </p>
      )}
    </>
  )
})
