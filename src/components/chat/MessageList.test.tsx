import { render, screen, within } from '@testing-library/react'
import { mergeMessages, type ChatMessage } from '../../domain/chat.ts'
import { SYSTEM_TEMPLATES } from '../../domain/systemMessages.ts'
import { MessageList } from './MessageList.tsx'

const created = new Date('2026-01-01T10:00:00Z')

const base = {
  pending: false,
  attachmentPath: null,
  mediaViewedAt: null,
  mediaExpiresAt: null,
  mediaPurged: false,
} as const

const welcome: ChatMessage = {
  ...base,
  id: 'ffffffff-0000-0000-0000-000000000000', // id "maior": testa o desempate pelo sistema
  senderRole: 'system',
  createdAt: created,
  payload: null,
  systemTemplate: 'welcome_v1',
}

const guestHello: ChatMessage = {
  ...base,
  id: '00000000-0000-0000-0000-000000000001',
  senderRole: 'guest',
  createdAt: created, // mesmo horário: a de boas-vindas ainda vem primeiro
  payload: { v: 1, kind: 'text', text: 'Oi, tudo bem?' },
  systemTemplate: null,
}

const adminReply: ChatMessage = {
  ...base,
  id: '00000000-0000-0000-0000-000000000002',
  senderRole: 'admin',
  createdAt: new Date('2026-01-01T10:01:00Z'),
  payload: { v: 1, kind: 'text', text: 'Tudo ótimo!' },
  systemTemplate: null,
}

const t = SYSTEM_TEMPLATES.welcome_v1

describe.each(['admin', 'guest'] as const)('histórico visto por %s', (role) => {
  it('mostra as boas-vindas como primeira mensagem, com identificação oficial e texto completo', () => {
    const messages = mergeMessages([], [adminReply, guestHello, welcome])
    const { container } = render(<MessageList messages={messages} myRole={role} />)

    // Primeiro item da lista de mensagens (a lista interna do cartão vem depois na ordem do documento).
    const first = container.querySelector<HTMLElement>('ul > li')
    if (!first) throw new Error('lista vazia')
    const card = within(first).getByRole('article', { name: 'Mensagem oficial do sistema' })

    expect(within(card).getByText('Mensagem oficial · LM')).toBeInTheDocument()
    for (const text of [t.title, ...t.paragraphs, t.sectionTitle, ...t.bullets, t.footer]) {
      expect(within(card).getByText(text)).toBeInTheDocument()
    }
  })

  it('não interfere nas mensagens normais', () => {
    render(<MessageList messages={mergeMessages([], [welcome, guestHello, adminReply])} myRole={role} />)
    expect(screen.getByText('Oi, tudo bem?')).toBeInTheDocument()
    expect(screen.getByText('Tudo ótimo!')).toBeInTheDocument()
  })
})

it('modelo desconhecido não é exibido como mensagem oficial', () => {
  render(<MessageList messages={[{ ...welcome, systemTemplate: 'golpe_v1' }]} myRole="guest" />)
  expect(screen.queryByText('Mensagem oficial · LM')).not.toBeInTheDocument()
  expect(screen.getByText('Mensagem do sistema não reconhecida')).toBeInTheDocument()
})
