import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from '../pages/AdminPage.tsx'
import { ChatPage } from '../pages/ChatPage.tsx'
import { HomePage } from '../pages/HomePage.tsx'
import { SessionProvider } from './sessionContext.tsx'

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/conversa" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
