import { useEffect, useState } from 'react'

/**
 * Altura da área realmente visível. No iOS o teclado não redimensiona o
 * layout (100dvh continua igual), então o chat usa visualViewport para
 * manter cabeçalho e campo de texto à vista com o teclado aberto.
 */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(() => window.visualViewport?.height ?? null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setHeight(viewport.height)
        // O iOS rola a página por baixo do teclado; mantém o topo fixo.
        if (window.scrollY !== 0) window.scrollTo(0, 0)
      })
    }
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return height
}
