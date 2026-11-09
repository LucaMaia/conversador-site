import { preventIosFocusZoom } from './mobileViewport.ts'

const BASE = 'width=device-width, initial-scale=1'

function setup(userAgent: string, maxTouchPoints = 5) {
  document.head.innerHTML = `<meta name="viewport" content="${BASE}">`
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  preventIosFocusZoom()
  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content
}

afterEach(() => vi.restoreAllMocks())

describe('preventIosFocusZoom', () => {
  it('desativa o zoom automático no iPhone', () => {
    expect(setup('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(`${BASE}, maximum-scale=1`)
  })

  it('desativa no iPad que se identifica como Mac', () => {
    expect(setup('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toContain('maximum-scale=1')
  })

  it('não altera Android (preserva o zoom com os dedos)', () => {
    expect(setup('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(BASE)
  })

  it('não altera o Mac de mesa', () => {
    expect(setup('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(BASE)
  })
})
