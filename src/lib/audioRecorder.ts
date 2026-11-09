import { baseMimeType, MAX_AUDIO_MS, pickAudioMimeType } from '../domain/audio.ts'
import {
  classifyGetUserMediaError,
  describeMicrophoneProblem,
  type MicrophoneProblem,
} from '../domain/microphoneErrors.ts'
import { currentBrowser } from './platform.ts'

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

export class RecorderError extends Error {
  readonly problem: MicrophoneProblem

  constructor(problem: MicrophoneProblem) {
    super(describeMicrophoneProblem(problem, currentBrowser()))
    this.name = 'RecorderError'
    this.problem = problem
  }
}

/** Formato a assumir quando o navegador não informa o tipo gravado. */
function fallbackMime(): string {
  const browser = currentBrowser()
  return browser === 'chrome-ios' || browser === 'safari-ios' || browser === 'other-ios' ? 'audio/mp4' : 'audio/webm'
}

/**
 * Cria o MediaRecorder com o formato preferido; se o navegador recusar
 * (o WebKit às vezes recusa no construtor um tipo que diz suportar),
 * usa o formato padrão do próprio navegador.
 */
function createRecorder(stream: MediaStream, mimeType: string | null): MediaRecorder {
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
    } catch {
      // tenta o padrão abaixo
    }
  }
  return new MediaRecorder(stream)
}

/**
 * Inicia a gravação pelo microfone.
 *
 * IMPORTANTE (iOS/WebKit): precisa ser chamada diretamente a partir de um
 * toque do usuário, e getUserMedia é a primeira operação assíncrona daqui,
 * para que o pedido de permissão aconteça dentro do gesto.
 *
 * O áudio fica só em memória. O microfone é liberado ao parar, cancelar,
 * em qualquer falha e se o sistema interromper a captura (ex.: ligação).
 *
 * onAutoStop é chamado quando a gravação deve ser encerrada sem ação do
 * usuário: duração máxima atingida ou captura interrompida pelo sistema.
 */
export async function startRecording(onAutoStop: () => void): Promise<RecordingSession> {
  if (!window.isSecureContext) throw new RecorderError('insecure-context')
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new RecorderError('unsupported')
  }
  const preferredType = pickAudioMimeType((t) => MediaRecorder.isTypeSupported(t))

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (err) {
    const name = err instanceof DOMException || err instanceof Error ? err.name : ''
    throw new RecorderError(classifyGetUserMediaError(name))
  }

  const releaseMic = () => stream.getTracks().forEach((track) => track.stop())

  let recorder: MediaRecorder
  try {
    recorder = createRecorder(stream, preferredType)
  } catch {
    releaseMic()
    throw new RecorderError('recorder-failed')
  }

  const chunks: Blob[] = []
  let finished = false
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  // Sem fatiamento (start sem timeslice): o WebKit gera MP4 mais confiável
  // quando entrega o arquivo inteiro ao parar.
  try {
    recorder.start()
  } catch {
    releaseMic()
    throw new RecorderError('recorder-failed')
  }
  const startedAt = performance.now()

  const limitTimer = setTimeout(onAutoStop, MAX_AUDIO_MS)
  // O sistema pode encerrar a captura (ligação, Siri, outro app usando o microfone).
  for (const track of stream.getAudioTracks()) {
    track.addEventListener('ended', () => {
      if (!finished) onAutoStop()
    })
  }

  return {
    stop() {
      if (finished) return Promise.reject(new RecorderError('recorder-failed'))
      finished = true
      clearTimeout(limitTimer)
      return new Promise<RecordedAudio>((resolve, reject) => {
        recorder.onstop = () => {
          releaseMic()
          const durationMs = Math.min(MAX_AUDIO_MS, performance.now() - startedAt)
          const type = baseMimeType(recorder.mimeType || chunks[0]?.type || fallbackMime())
          const blob = new Blob(chunks, { type })
          if (blob.size === 0) reject(new RecorderError('empty'))
          else resolve({ blob, mime: type, durationMs })
        }
        recorder.onerror = () => {
          releaseMic()
          reject(new RecorderError('recorder-failed'))
        }
        if (recorder.state === 'inactive') {
          // Já parado pelo sistema: dispara o fechamento manualmente.
          recorder.onstop(new Event('stop'))
        } else {
          recorder.stop()
        }
      })
    },
    cancel() {
      if (finished) return
      finished = true
      clearTimeout(limitTimer)
      chunks.length = 0
      recorder.ondataavailable = null
      recorder.onstop = releaseMic
      if (recorder.state !== 'inactive') recorder.stop()
      else releaseMic()
    },
  }
}
