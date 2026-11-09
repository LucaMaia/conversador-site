import { RecorderError, startRecording } from './audioRecorder.ts'

// ---------------------------------------------------------------------------
// Microfone e MediaRecorder simulados (jsdom não tem nenhum dos dois)
// ---------------------------------------------------------------------------
function fakeStream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() }
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream }
}

class FakeRecorder {
  static isTypeSupported = vi.fn((_type: string) => true)
  static rejectMimeInConstructor = false
  static alwaysThrow = false
  static instances: FakeRecorder[] = []

  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: ((e: Event) => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    if (FakeRecorder.alwaysThrow) throw new DOMException('no', 'NotSupportedError')
    if (options?.mimeType && FakeRecorder.rejectMimeInConstructor) throw new DOMException('no', 'NotSupportedError')
    this.mimeType = options?.mimeType ?? 'audio/mp4'
    FakeRecorder.instances.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType }) })
    this.onstop?.(new Event('stop'))
  }
}

let getUserMedia: ReturnType<typeof vi.fn>
let current: ReturnType<typeof fakeStream>

beforeEach(() => {
  current = fakeStream()
  getUserMedia = vi.fn(async () => current.stream)
  FakeRecorder.rejectMimeInConstructor = false
  FakeRecorder.alwaysThrow = false
  FakeRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 CriOS/131.0 Mobile/15E148',
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('gravação de áudio', () => {
  it('pede o microfone de forma síncrona ao toque (exigência do iOS)', () => {
    void startRecording(() => {})
    // Sem nenhum await antes: o pedido acontece ainda dentro do gesto do usuário.
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('grava e libera o microfone ao parar', async () => {
    const session = await startRecording(() => {})
    const audio = await session.stop()
    expect(audio.mime).toBe('audio/mp4')
    expect(audio.blob.size).toBeGreaterThan(0)
    expect(current.track.stop).toHaveBeenCalled()
  })

  it('permissão negada no Chrome do iPhone explica os Ajustes do iOS', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    const error = await startRecording(() => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RecorderError)
    expect((error as RecorderError).problem).toBe('denied')
    expect((error as RecorderError).message).toContain('Ajustes › Chrome')
  })

  it('microfone ocupado tem diagnóstico próprio', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('busy', 'NotReadableError'))
    await expect(startRecording(() => {})).rejects.toMatchObject({ problem: 'in-use' })
  })

  it('usa o formato padrão do navegador se o preferido for recusado no construtor', async () => {
    FakeRecorder.rejectMimeInConstructor = true
    const session = await startRecording(() => {})
    expect(FakeRecorder.instances).toHaveLength(1)
    expect((await session.stop()).blob.size).toBeGreaterThan(0)
  })

  it('libera o microfone se o gravador não puder ser criado', async () => {
    FakeRecorder.alwaysThrow = true
    await expect(startRecording(() => {})).rejects.toMatchObject({ problem: 'recorder-failed' })
    expect(current.track.stop).toHaveBeenCalled()
  })

  it('cancelar descarta o áudio e libera o microfone', async () => {
    const session = await startRecording(() => {})
    session.cancel()
    expect(current.track.stop).toHaveBeenCalled()
  })

  it('não pede o microfone fora de conexão segura', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    await expect(startRecording(() => {})).rejects.toMatchObject({ problem: 'insecure-context' })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('navegador sem MediaRecorder recebe mensagem de incompatibilidade', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    await expect(startRecording(() => {})).rejects.toMatchObject({ problem: 'unsupported' })
  })
})
