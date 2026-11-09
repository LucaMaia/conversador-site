import type { BrowserKind } from '../lib/platform.ts'

export type MicrophoneProblem =
  | 'insecure-context'
  | 'unsupported'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'recorder-failed'
  | 'empty'

/**
 * Converte o nome do erro da API (DOMException.name) no problema real.
 * Referência: https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia#exceptions
 */
export function classifyGetUserMediaError(name: string): MicrophoneProblem {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError': // nome antigo
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use'
    case 'TypeError':
      return 'unsupported'
    default:
      return 'recorder-failed'
  }
}

const DENIED_HELP: Record<BrowserKind, string> = {
  'chrome-ios':
    'Microfone bloqueado. No iPhone, abra Ajustes › Chrome e ative "Microfone". Se já estiver ativo, no Chrome toque no ícone à esquerda do endereço › Permissões e permita o microfone. Depois toque no microfone de novo.',
  'safari-ios':
    'Microfone bloqueado. Toque em "aA" na barra de endereço › Ajustes do Site › Microfone › Permitir. Se não aparecer, abra Ajustes › Apps › Safari › Microfone e escolha "Perguntar" ou "Permitir".',
  'other-ios':
    'Microfone bloqueado neste app. Abra o site no Safari ou no Chrome, ou ative o microfone para este app em Ajustes do iPhone.',
  android:
    'Microfone bloqueado. Toque no ícone à esquerda do endereço › Permissões › Microfone › Permitir. Se continuar, ative o microfone para o navegador em Configurações › Apps.',
  desktop:
    'Microfone bloqueado. Clique no ícone à esquerda do endereço, permita o microfone para este site e tente de novo.',
}

export function describeMicrophoneProblem(problem: MicrophoneProblem, browser: BrowserKind): string {
  switch (problem) {
    case 'denied':
      return DENIED_HELP[browser]
    case 'insecure-context':
      return 'O microfone só funciona em conexão segura (https).'
    case 'unsupported':
      return browser === 'other-ios'
        ? 'Este app não permite gravar áudio. Abra o site no Safari ou no Chrome.'
        : 'Este navegador não permite gravar áudio. Atualize o sistema ou use outro navegador.'
    case 'not-found':
      return 'Nenhum microfone foi encontrado neste aparelho.'
    case 'in-use':
      return 'O microfone está em uso por outro app (por exemplo, uma ligação). Encerre e tente de novo.'
    case 'empty':
      return 'Nenhum áudio foi gravado. Tente de novo.'
    case 'recorder-failed':
      return 'Não foi possível gravar neste navegador. Tente de novo.'
  }
}
