import { SYSTEM_TEMPLATES, systemMessagePlainText, systemTemplate } from './systemMessages.ts'

// Texto exatamente como solicitado.
const EXPECTED_WELCOME = `👋 Bem-vindo!

Este é um ambiente de comunicação privada, desenvolvido pelo LM, com funcionamento semelhante ao WhatsApp.

Aqui você pode trocar mensagens, fotos, vídeos e áudios.

🔒 Sobre a privacidade:

* Fotos, vídeos e áudios são excluídos automaticamente após 15 minutos.
* Conversas e todo o histórico são excluídos após 24 horas da criação.

A plataforma utiliza mecanismos de segurança e criptografia para proteger suas informações.`

describe('mensagens do sistema', () => {
  it('boas-vindas com o texto exato', () => {
    expect(systemMessagePlainText(SYSTEM_TEMPLATES.welcome_v1)).toBe(EXPECTED_WELCOME)
  })

  it('identificador desconhecido nunca vira mensagem oficial', () => {
    expect(systemTemplate('welcome_v1')).toBe(SYSTEM_TEMPLATES.welcome_v1)
    expect(systemTemplate('golpe_v1')).toBeNull()
    expect(systemTemplate('toString')).toBeNull()
    expect(systemTemplate(null)).toBeNull()
  })
})
