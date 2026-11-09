import { detectBrowser } from '../lib/platform.ts'
import { classifyGetUserMediaError, describeMicrophoneProblem } from './microphoneErrors.ts'

const UA = {
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  instagramIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

describe('detectBrowser', () => {
  it('distingue Chrome e Safari no iPhone', () => {
    expect(detectBrowser(UA.chromeIphone, 5)).toBe('chrome-ios')
    expect(detectBrowser(UA.safariIphone, 5)).toBe('safari-ios')
  })

  it('identifica navegadores embutidos em apps', () => {
    expect(detectBrowser(UA.instagramIphone, 5)).toBe('other-ios')
  })

  it('identifica iPad que se apresenta como Mac', () => {
    expect(detectBrowser(UA.chromeMac.replace('Chrome/131.0.0.0 ', ''), 5)).toBe('safari-ios')
  })

  it('Android e computador', () => {
    expect(detectBrowser(UA.android, 5)).toBe('android')
    expect(detectBrowser(UA.chromeMac, 0)).toBe('desktop')
  })
})

describe('erros do microfone', () => {
  it('classifica os erros do getUserMedia', () => {
    expect(classifyGetUserMediaError('NotAllowedError')).toBe('denied')
    expect(classifyGetUserMediaError('SecurityError')).toBe('denied')
    expect(classifyGetUserMediaError('NotFoundError')).toBe('not-found')
    expect(classifyGetUserMediaError('NotReadableError')).toBe('in-use')
    expect(classifyGetUserMediaError('AlgoInesperado')).toBe('recorder-failed')
  })

  it('no Chrome do iPhone, explica a permissão do app nos Ajustes do iOS', () => {
    const text = describeMicrophoneProblem('denied', 'chrome-ios')
    expect(text).toContain('Ajustes › Chrome')
    expect(text).toContain('Microfone')
  })

  it('no Safari do iPhone, aponta os ajustes do site', () => {
    expect(describeMicrophoneProblem('denied', 'safari-ios')).toContain('Ajustes do Site')
  })

  it('microfone ocupado tem mensagem própria', () => {
    expect(describeMicrophoneProblem('in-use', 'chrome-ios')).toContain('em uso')
  })
})
