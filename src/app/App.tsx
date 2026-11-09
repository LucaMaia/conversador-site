import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ChatPage } from '../pages/ChatPage.tsx'
import { HomePage } from '../pages/HomePage.tsx'
import { SessionProvider } from './sessionContext.tsx'

// O painel só é baixado por quem acessa /admin: o convidado carrega menos código.
const AdminPage = lazy(() => import('../pages/AdminPage.tsx').then((m) => ({ default: m.AdminPage })))

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={null}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="/conversa" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
