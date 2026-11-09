/**
 * O Safari do iOS amplia a tela ao focar um campo de texto. A fonte de 16px
 * evita isso na maioria dos casos, mas não quando o usuário usa zoom de
 * página < 100% ou navegadores embutidos (Instagram, WhatsApp etc.).
 *
 * maximum-scale=1 desativa esse zoom automático. É aplicado SOMENTE no iOS,
 * onde o Safari ignora maximum-scale para o gesto de pinça (o usuário ainda
 * pode ampliar com os dedos). No Android, a mesma regra bloquearia a pinça,
 * e lá o zoom ao focar não acontece, então nada é alterado.
 */
export function preventIosFocusZoom(): void {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (!isIos) return

  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (meta && !meta.content.includes('maximum-scale')) {
    meta.content = `${meta.content}, maximum-scale=1`
  }
}
