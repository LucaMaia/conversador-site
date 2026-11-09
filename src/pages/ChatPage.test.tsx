import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession, type AdminSession, type RoomSession } from '../app/sessionContext.tsx'

// O chat real depende do Supabase; aqui testamos só a navegação de saída.
vi.mock('../hooks/useRoomChat.ts', () => ({
  useRoomChat: () => ({
    messages: [],
    status: { kind: 'ready' },
    expiresAt: null,
    connected: true,
    sendError: null,
    sendText: async () => {},
    sendImage: async () => {},
    sendAudio: async () => {},
    sendVideo: async () => {},
  }),
}))
vi.mock('../hooks/useServerClock.ts', () => ({ useServerClock: () => ({ now: new Date(), synced: true }) }))
vi.mock('../services/authService.ts', () => ({ signOut: vi.fn(async () => {}) }))
vi.mock('../services/activityService.ts', () => ({ markRoomRead: vi.fn(async () => {}) }))

const { ChatPage } = await import('./ChatPage.tsx')

const fakeKey = {} as CryptoKey

function Seed({ admin, room }: { admin: AdminSession | null; room: RoomSession }) {
  const { setAdmin, setRoom, room: current } = useSession()
  if (!current) {
    queueMicrotask(() => {
      setAdmin(admin)
      setRoom(room)
    })
    return null
  }
  return <ChatPage />
}

function renderChat(role: 'admin' | 'guest') {
  const admin = role === 'admin' ? { userId: 'u', masterKey: fakeKey } : null
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/conversa']}>
        <Routes>
          <Route path="/" element={<p>tela do código</p>} />
          <Route path="/admin" element={<p>lista de conversas</p>} />
          <Route path="/conversa" element={<Seed admin={admin} room={{ roomId: 'r', roomKey: fakeKey, role }} />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

// Reproduz o instante em que a sessão da conversa já foi limpa, mas a rota
// ainda é /conversa (o React Router aplica a navegação depois).
function renderWithoutRoom(admin: AdminSession | null) {
  function SeedAdmin() {
    const { setAdmin, admin: current } = useSession()
    if (admin && !current) {
      queueMicrotask(() => setAdmin(admin))
      return null
    }
    return <ChatPage />
  }
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/conversa']}>
        <Routes>
          <Route path="/" element={<p>tela do código</p>} />
          <Route path="/admin" element={<p>lista de conversas</p>} />
          <Route path="/conversa" element={<SeedAdmin />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('chat sem sessão de conversa', () => {
  it('admin desbloqueado é levado à lista de conversas', async () => {
    renderWithoutRoom({ userId: 'u', masterKey: fakeKey })
    expect(await screen.findByText('lista de conversas')).toBeInTheDocument()
  })

  it('sem admin, vai para a tela do código', async () => {
    renderWithoutRoom(null)
    expect(await screen.findByText('tela do código')).toBeInTheDocument()
  })
})

describe('saída do chat', () => {
  it('admin volta para a lista de conversas', async () => {
    renderChat('admin')
    const back = await screen.findByRole('button', { name: /Painel/ })
    await act(async () => back.click())
    expect(await screen.findByText('lista de conversas')).toBeInTheDocument()
  })

  it('convidado volta para a tela do código', async () => {
    renderChat('guest')
    const leave = await screen.findByRole('button', { name: 'Sair' })
    await act(async () => leave.click())
    expect(await screen.findByText('tela do código')).toBeInTheDocument()
  })
})
