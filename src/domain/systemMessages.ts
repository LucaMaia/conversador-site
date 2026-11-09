// Mensagens oficiais do sistema. O banco guarda apenas o identificador do
// modelo; o texto vive aqui, no código do site. Um identificador desconhecido
// nunca é exibido como mensagem oficial.

export interface SystemMessageTemplate {
  readonly title: string
  readonly paragraphs: readonly string[]
  readonly sectionTitle: string
  readonly bullets: readonly string[]
  readonly footer: string
}

export const SYSTEM_TEMPLATES = {
  welcome_v1: {
    title: '👋 Bem-vindo!',
    paragraphs: [
      'Este é um ambiente de comunicação privada, desenvolvido pelo LM, com funcionamento semelhante ao WhatsApp.',
      'Aqui você pode trocar mensagens, fotos, vídeos e áudios.',
    ],
    sectionTitle: '🔒 Sobre a privacidade:',
    bullets: [
      'Fotos, vídeos e áudios são excluídos automaticamente após 15 minutos.',
      'Conversas e todo o histórico são excluídos após 24 horas da criação.',
    ],
    footer: 'A plataforma utiliza mecanismos de segurança e criptografia para proteger suas informações.',
  },
} as const satisfies Record<string, SystemMessageTemplate>

export type SystemTemplateId = keyof typeof SYSTEM_TEMPLATES

export function systemTemplate(id: string | null): SystemMessageTemplate | null {
  if (id === null || !Object.hasOwn(SYSTEM_TEMPLATES, id)) return null
  return SYSTEM_TEMPLATES[id as SystemTemplateId]
}

/** Texto completo, na forma em que foi definido. */
export function systemMessagePlainText(template: SystemMessageTemplate): string {
  return [
    template.title,
    ...template.paragraphs,
    template.sectionTitle,
    template.bullets.map((b) => `* ${b}`).join('\n'),
    template.footer,
  ].join('\n\n')
}
