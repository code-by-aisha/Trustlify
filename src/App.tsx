import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const Landing = lazy(() => import('./pages/Landing'))
const Auth = lazy(() => import('./pages/Auth'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Investigate = lazy(() => import('./pages/Investigate'))
const InvestigationProgress = lazy(() => import('./pages/InvestigationProgress'))
const EvidenceGraph = lazy(() => import('./pages/EvidenceGraph'))
const InvestigationResult = lazy(() => import('./pages/InvestigationResult'))
const StudentMatch = lazy(() => import('./pages/StudentMatch'))
const Monitoring = lazy(() => import('./pages/Monitoring'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
        <span className="font-mono text-xs text-dim tracking-wider">LOADING…</span>
      </div>
    </div>
  )
}

/** Route guard: redirects to /auth if not authenticated */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/auth" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Protected — require authentication */}
        <Route path="/student/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/investigate" element={<ProtectedRoute><Investigate /></ProtectedRoute>} />

        {/* Investigation flow */}
        <Route path="/investigation/:id/progress" element={<ProtectedRoute><InvestigationProgress /></ProtectedRoute>} />
        <Route path="/investigation/:id/evidence" element={<ProtectedRoute><EvidenceGraph /></ProtectedRoute>} />
        <Route path="/investigation/:id/match" element={<ProtectedRoute><StudentMatch /></ProtectedRoute>} />
        <Route path="/investigation/:id" element={<ProtectedRoute><InvestigationResult /></ProtectedRoute>} />

        {/* Other protected screens */}
        <Route path="/monitoring" element={<ProtectedRoute><Monitoring /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
