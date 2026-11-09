/**
 * Identifica o navegador para dar instruções de permissão corretas.
 * No iOS, todo navegador (Chrome, Firefox, Edge) usa o WebKit da Apple, e a
 * permissão do microfone tem duas camadas: a do app (Ajustes do iOS) e a do site.
 */
export type BrowserKind = 'chrome-ios' | 'safari-ios' | 'other-ios' | 'android' | 'desktop'

export function detectBrowser(userAgent: string, maxTouchPoints: number): BrowserKind {
  const isIPadOs = /Macintosh/.test(userAgent) && maxTouchPoints > 1
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || isIPadOs
  if (isIos) {
    if (/CriOS\//.test(userAgent)) return 'chrome-ios'
    if (/FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|WhatsApp/.test(userAgent)) return 'other-ios'
    return 'safari-ios'
  }
  if (/Android/.test(userAgent)) return 'android'
  return 'desktop'
}

export function currentBrowser(): BrowserKind {
  return detectBrowser(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}
