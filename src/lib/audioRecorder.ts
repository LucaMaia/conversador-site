import { baseMimeType, MAX_AUDIO_MS, pickAudioMimeType } from '../domain/audio.ts'

export interface RecordedAudio {
  readonly blob: Blob
  readonly mime: string
  readonly durationMs: number
}

export interface RecordingSession {
  /** Para e entrega o áudio gravado. */
  stop(): Promise<RecordedAudio>
  /** Descarta a gravação. */
  cancel(): void
}

export type RecorderErrorCode = 'unsupported' | 'denied' | 'failed'

export class RecorderError extends Error {
  readonly code: RecorderErrorCode

  constructor(code: RecorderErrorCode, message: string) {
    super(message)
    this.name = 'RecorderError'
    this.code = code
  }
}

/**
 * Inicia a gravação pelo microfone (precisa ser chamado a partir de um toque).
 * O áudio fica só em memória; o microfone é liberado ao parar ou cancelar.
 * onLimit é chamado se a duração máxima for atingida.
 */
export async function startRecording(onLimit: () => void): Promise<RecordingSession> {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new RecorderError('unsupported', 'Este navegador não grava áudio.')
  }
  const mimeType = pickAudioMimeType((t) => MediaRecorder.isTypeSupported(t))
  if (!mimeType) throw new RecorderError('unsupported', 'Este navegador não grava áudio.')

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
  } catch (err) {
    const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
    throw new RecorderError(
      denied ? 'denied' : 'failed',
      denied ? 'Permita o acesso ao microfone para gravar.' : 'Não foi possível acessar o microfone.',
    )
  }

  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
  const chunks: Blob[] = []
  const startedAt = performance.now()
  let finished = false

  const releaseMic = () => stream.getTracks().forEach((track) => track.stop())
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start(1000)

  const limitTimer = setTimeout(onLimit, MAX_AUDIO_MS)

  return {
    stop() {
      if (finished) return Promise.reject(new RecorderError('failed', 'Gravação já encerrada.'))
      finished = true
      clearTimeout(limitTimer)
      return new Promise<RecordedAudio>((resolve, reject) => {
        recorder.onstop = () => {
          releaseMic()
          const durationMs = Math.min(MAX_AUDIO_MS, performance.now() - startedAt)
          const type = baseMimeType(recorder.mimeType || mimeType)
          const blob = new Blob(chunks, { type })
          if (blob.size === 0) reject(new RecorderError('failed', 'Nenhum áudio foi gravado.'))
          else resolve({ blob, mime: type, durationMs })
        }
        recorder.onerror = () => {
          releaseMic()
          reject(new RecorderError('failed', 'Falha na gravação.'))
        }
        recorder.stop()
      })
    },
    cancel() {
      if (finished) return
      finished = true
      clearTimeout(limitTimer)
      recorder.onstop = releaseMic
      if (recorder.state !== 'inactive') recorder.stop()
      else releaseMic()
      chunks.length = 0
    },
  }
}
