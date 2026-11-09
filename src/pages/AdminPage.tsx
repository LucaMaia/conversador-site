import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../app/sessionContext.tsx'
import { AdminDashboard } from '../components/admin/AdminDashboard.tsx'
import { AdminLoginForm } from '../components/admin/AdminLoginForm.tsx'
import { VaultForm } from '../components/admin/VaultForm.tsx'
import { CenteredCard } from '../components/ui/CenteredCard.tsx'
import { ErrorText } from '../components/ui/ErrorText.tsx'
import type { VaultRecord } from '../lib/crypto/index.ts'
import { signOut } from '../services/authService.ts'
import { fetchVaultRecord } from '../services/vaultService.ts'

// Fluxo: login → cofre (criar ou desbloquear) → painel.
// A sessão desbloqueada fica no SessionContext, somente em memória.
type UnlockState =
  | { step: 'login' }
  | { step: 'loading-vault'; userId: string }
  | { step: 'vault'; userId: string; record: VaultRecord | null }
  | { step: 'error'; message: string }

export function AdminPage() {
  const navigate = useNavigate()
  const { admin, setAdmin, setRoom } = useSession()
  const [state, setState] = useState<UnlockState>({ step: 'login' })

  useEffect(() => {
    if (state.step !== 'loading-vault') return
    let cancelled = false
    fetchVaultRecord(state.userId)
      .then((record) => {
        if (!cancelled) setState({ step: 'vault', userId: state.userId, record })
      })
      .catch(() => {
        if (!cancelled) setState({ step: 'error', message: 'Não foi possível carregar o cofre.' })
      })
    return () => {
      cancelled = true
    }
  }, [state])

  async function handleSignOut() {
    setAdmin(null)
    setRoom(null)
    setState({ step: 'login' })
    await signOut()
  }

  if (admin) {
    return (
      <AdminDashboard
        userId={admin.userId}
        masterKey={admin.masterKey}
        onSignOut={handleSignOut}
        onEnterRoom={(roomSession) => {
          setRoom(roomSession)
          navigate('/conversa')
        }}
      />
    )
  }

  switch (state.step) {
    case 'login':
      return (
        <AdminLoginForm
          onSignedIn={({ userId }) => {
            setRoom(null)
            setState({ step: 'loading-vault', userId })
          }}
        />
      )
    case 'loading-vault':
      return <CenteredCard title="Carregando cofre…">{null}</CenteredCard>
    case 'vault':
      return (
        <VaultForm
          userId={state.userId}
          record={state.record}
          onUnlocked={(masterKey) => setAdmin({ userId: state.userId, masterKey })}
          onCancel={handleSignOut}
        />
      )
    case 'error':
      return (
        <CenteredCard title="Erro">
          <ErrorText message={state.message} />
        </CenteredCard>
      )
  }
}
