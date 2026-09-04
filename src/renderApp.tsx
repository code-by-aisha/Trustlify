/**
 * Trustlify Frontend — App Mount
 *
 * Kept out of main.tsx and imported only after the startup environment check
 * passes, so no Supabase-dependent module is evaluated against a bad build.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import App from './App'

export function renderApp(element: HTMLElement) {
  createRoot(element).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
